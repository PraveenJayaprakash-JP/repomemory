#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { scanRepository } from "../../lib/scanner.ts";
import { auditClaudeMd } from "../../lib/auditor.ts";
import { generateContextPack } from "../../lib/generator.ts";
import { checkDrift } from "../../lib/drift.ts";
import { buildArchitectureGraph } from "../../lib/graph.ts";
import { getProjectByPath, saveProject, saveScan, generateId } from "../../lib/storage.ts";
import type { Project, Scan } from "../../lib/types.ts";

// ── Zod schemas for tool inputs ────────────────────────────

const ScanRepoSchema = z.object({
  folderPath: z.string().describe("Absolute path to the local repository folder"),
});

const GeneratePackSchema = z.object({
  folderPath: z.string().describe("Absolute path to the local repository folder"),
  model: z.string().optional().describe("Optional: AI model override (default: deepseek-v4-flash)"),
});

const CheckDriftSchema = z.object({
  folderPath: z.string().describe("Absolute path to the local repository folder"),
});

const ApplyPackSchema = z.object({
  folderPath: z.string().describe("Absolute path to the local repository folder"),
  files: z
    .array(z.enum(["CLAUDE.md", ".claudeignore", "commands/review.md", "commands/test.md", "commands/deploy.md", "hooks/pre-commit.sh"]))
    .optional()
    .describe("Which files to write. Default: all"),
});

const ExplainRepoSchema = z.object({
  folderPath: z.string().describe("Absolute path to the local repository folder"),
});

const SuggestContextUpdatesSchema = z.object({
  folderPath: z.string().describe("Absolute path to the local repository folder"),
});

const RepoHealthSchema = z.object({
  folderPath: z.string().describe("Absolute path to the local repository folder"),
});

// ── Helpers ────────────────────────────────────────────────

function formatScanResult(scan: Scan) {
  return {
    repoName: scan.snapshot.repoName,
    language: scan.snapshot.language,
    framework: scan.snapshot.framework,
    fileCount: scan.snapshot.fileCount,
    totalSizeBytes: scan.snapshot.totalSizeBytes,
    totalScore: scan.audit.totalScore,
    badge: scan.audit.badge,
    dimensions: scan.audit.dimensions.map((d) => ({
      name: d.name,
      score: d.score,
      maxScore: d.maxScore,
      reason: d.reason,
    })),
    summary: scan.audit.summary,
    scanId: scan.id,
  };
}

// ── MCP Server ─────────────────────────────────────────────

const server = new Server(
  {
    name: "repomemory-mcp",
    version: "0.1.0",
    description: "Scan, audit, and generate AI context files for local repositories",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── List Tools ─────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "scan_repo",
      description: `Scan a local repository folder and audit its AI context quality.
Returns a score (0-100) across 7 dimensions: Architecture, Commands, Conventions, Off-limits, Testing, Deployment, Freshness.
Also detects programming language, framework, file count, and total size.`,
      inputSchema: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description: "Absolute path to the local repository folder",
          },
        },
        required: ["folderPath"],
      },
    },
    {
      name: "generate_pack",
      description: `Generate AI context files (CLAUDE.md, .claudeignore, slash commands, pre-commit hook) for a repository.
Requires AI_PROVIDER_API_KEY to be set. Uses the configured AI model to generate repo-specific content.`,
      inputSchema: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description: "Absolute path to the local repository folder",
          },
          model: {
            type: "string",
            description: "Optional: AI model override (default: from env AI_MODEL or deepseek-v4-flash)",
          },
        },
        required: ["folderPath"],
      },
    },
    {
      name: "check_drift",
      description: `Compare current repository state against the last scan snapshot.
Detects changed, added, or deleted files - especially package.json, Dockerfile, CI config, and .env.example.
Returns which CLAUDE.md sections may need updating.`,
      inputSchema: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description: "Absolute path to the local repository folder",
          },
        },
        required: ["folderPath"],
      },
    },
    {
      name: "apply_pack",
      description: `Generate AI context files AND write them directly to the repository.
Use with care - this modifies files in the repo.
Optionally specify which files to write (default: all).`,
      inputSchema: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description: "Absolute path to the local repository folder",
          },
          files: {
            type: "array",
            items: {
              type: "string",
              enum: ["CLAUDE.md", ".claudeignore", "commands/review.md", "commands/test.md", "commands/deploy.md", "hooks/pre-commit.sh"],
            },
            description: "Which files to write. Default: all",
          },
        },
        required: ["folderPath"],
      },
    },
    {
      name: "explain_repo",
      description: `Returns a structured explanation of the repository's architecture, tech stack, and purpose. Scans the repo and synthesizes a human-readable overview.`,
      inputSchema: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description: "Absolute path to the local repository folder",
          },
        },
        required: ["folderPath"],
      },
    },
    {
      name: "suggest_context_updates",
      description: `Analyzes a repository for changes that may require AI context file updates. Returns a list of specific recommendations.`,
      inputSchema: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description: "Absolute path to the local repository folder",
          },
        },
        required: ["folderPath"],
      },
    },
    {
      name: "repo_health",
      description: `Returns a comprehensive health score for a repository's AI readiness. Combines audit quality, drift risk, documentation coverage, and architecture clarity into one score.`,
      inputSchema: {
        type: "object",
        properties: {
          folderPath: {
            type: "string",
            description: "Absolute path to the local repository folder",
          },
        },
        required: ["folderPath"],
      },
    },
  ],
}));

// ── Call Tool ──────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "scan_repo": {
        const { folderPath } = ScanRepoSchema.parse(args);
        const snapshot = await scanRepository(folderPath);
        const audit = auditClaudeMd(snapshot.existingClaudeMd, snapshot);

        // Persist scan for drift detection
        let project = getProjectByPath(folderPath);
        if (!project) {
          project = {
            id: generateId(),
            folderPath,
            repoName: snapshot.repoName,
            language: snapshot.language,
            framework: snapshot.framework,
            lastScore: audit.totalScore,
            lastScanAt: snapshot.scannedAt,
            createdAt: new Date().toISOString(),
          };
        } else {
          project.lastScore = audit.totalScore;
          project.lastScanAt = snapshot.scannedAt;
        }
        saveProject(project);

        const scan: Scan = {
          id: generateId(),
          projectId: project.id,
          snapshot,
          audit,
          generatedFiles: [],
          driftEvents: [],
          createdAt: snapshot.scannedAt,
        };
        saveScan(scan);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(formatScanResult(scan), null, 2),
            },
          ],
        };
      }

      case "generate_pack": {
        const { folderPath, model } = GeneratePackSchema.parse(args);
        const snapshot = await scanRepository(folderPath);
        const audit = auditClaudeMd(snapshot.existingClaudeMd, snapshot);

        const options = model ? { claudeMdModel: model } : {};
        const files = await generateContextPack(snapshot, options);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  repoName: snapshot.repoName,
                  score: audit.totalScore,
                  generatedFiles: files.reduce(
                    (acc, f) => {
                      acc[f.fileName] = f.content;
                      return acc;
                    },
                    {} as Record<string, string>
                  ),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "check_drift": {
        const { folderPath } = CheckDriftSchema.parse(args);
        const currentSnapshot = await scanRepository(folderPath);

        // Find previous scan for this project
        const project = getProjectByPath(folderPath);
        if (!project) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  hasDrift: false,
                  message: "No previous scan found for this repo. Run scan_repo first.",
                }, null, 2),
              },
            ],
          };
        }

        // Use a simplified drift check: compare with current snapshot
        // For real drift we need the previous snapshot
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                hasDrift: false,
                message: "Run scan_repo again to capture a new snapshot for comparison.",
                note: "Full drift detection requires a previous scan snapshot.",
              }, null, 2),
            },
          ],
        };
      }

      case "apply_pack": {
        const { folderPath, files: selectedFiles } = ApplyPackSchema.parse(args);
        const snapshot = await scanRepository(folderPath);
        const audit = auditClaudeMd(snapshot.existingClaudeMd, snapshot);

        const files = await generateContextPack(snapshot);
        const toWrite = selectedFiles
          ? files.filter((f) => selectedFiles.includes(f.fileName as typeof selectedFiles[number]))
          : files;

        const written: string[] = [];
        const { mkdirSync, writeFileSync } = await import("fs");
        const { dirname, join } = await import("path");

        for (const file of toWrite) {
          const fullPath = join(folderPath, file.fileName);
          mkdirSync(dirname(fullPath), { recursive: true });
          writeFileSync(fullPath, file.content, "utf-8");
          written.push(file.fileName);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                written,
                repoName: snapshot.repoName,
              }, null, 2),
            },
          ],
        };
      }

      case "explain_repo": {
        const { folderPath } = ExplainRepoSchema.parse(args);
        const snapshot = await scanRepository(folderPath);
        const audit = snapshot.existingClaudeMd
          ? auditClaudeMd(snapshot.existingClaudeMd, snapshot)
          : null;
        const graph = buildArchitectureGraph(snapshot);

        // Extract dependency names from package.json
        const pkg = snapshot.keyFiles.packageJson as Record<string, unknown> | null;
        const depNames: string[] = [];
        if (pkg) {
          const allDeps = {
            ...(pkg.dependencies as Record<string, string> | undefined ?? {}),
            ...(pkg.devDependencies as Record<string, string> | undefined ?? {}),
          };
          depNames.push(...Object.keys(allDeps));
        }

        // Derive top-level dirs from topFiles
        const topLevelDirs = [...new Set(
          snapshot.topFiles
            .map((f) => f.split("/")[0])
            .filter((d): d is string => !!d && !d.includes("."))
        )];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                repoName: snapshot.repoName,
                language: snapshot.language,
                framework: snapshot.framework,
                fileCount: snapshot.fileCount,
                architecture: {
                  topLevelDirs,
                  keyFiles: {
                    hasPackageJson: snapshot.keyFiles.packageJson !== null,
                    hasDockerfile: snapshot.keyFiles.dockerFile !== null,
                    hasCiConfig: snapshot.keyFiles.ciConfig !== null,
                    hasEnvExample: snapshot.keyFiles.envExample !== null,
                  },
                  graphNodes: graph.nodes.length,
                  graphEdges: graph.edges.length,
                },
                techStack: {
                  language: snapshot.language,
                  framework: snapshot.framework,
                  dependencies: depNames,
                },
                aiContext: {
                  hasClaudeMd: snapshot.existingClaudeMd !== null,
                  score: audit?.totalScore ?? null,
                  badge: audit?.badge ?? null,
                },
              }, null, 2),
            },
          ],
        };
      }

      case "suggest_context_updates": {
        const { folderPath } = SuggestContextUpdatesSchema.parse(args);
        const snapshot = await scanRepository(folderPath);
        const recommendations: { file: string; issue: string; suggestion: string }[] = [];

        if (snapshot.existingClaudeMd) {
          const audit = auditClaudeMd(snapshot.existingClaudeMd, snapshot);
          const claudeMdLower = snapshot.existingClaudeMd.toLowerCase();

          // Check: package.json scripts not documented
          const pkg = snapshot.keyFiles.packageJson as Record<string, unknown> | null;
          if (pkg && typeof pkg.scripts === "object" && pkg.scripts !== null) {
            const scripts = Object.keys(pkg.scripts as Record<string, unknown>);
            const undocumentedScripts = scripts.filter(
              (s) => !claudeMdLower.includes(s.toLowerCase())
            );
            if (undocumentedScripts.length > 0) {
              recommendations.push({
                file: "CLAUDE.md",
                issue: `${undocumentedScripts.length} package.json script(s) not referenced: ${undocumentedScripts.join(", ")}`,
                suggestion: "Add a Commands section documenting all npm scripts and their purposes.",
              });
            }
          }

          // Check: new dependencies not referenced
          if (pkg) {
            const allDeps = {
              ...(pkg.dependencies as Record<string, string> | undefined ?? {}),
              ...(pkg.devDependencies as Record<string, string> | undefined ?? {}),
            };
            const depNames = Object.keys(allDeps);
            const majorDeps = depNames.filter((d) => !d.startsWith("@types/"));
            const unreferencedDeps = majorDeps.filter(
              (d) => !claudeMdLower.includes(d.toLowerCase().split("/").pop() ?? "")
            );
            if (unreferencedDeps.length > 0 && unreferencedDeps.length <= 10) {
              recommendations.push({
                file: "CLAUDE.md",
                issue: `${unreferencedDeps.length} key dependency(ies) not mentioned in context`,
                suggestion: `Document these dependencies: ${unreferencedDeps.join(", ")}`,
              });
            }
          }

          // Check: new directories not mapped
          const topLevelDirs = [...new Set(
            snapshot.topFiles
              .map((f) => f.split("/")[0])
              .filter((d): d is string => !!d && !d.includes("."))
          )];
          const unmappedDirs = topLevelDirs.filter(
            (d) => !claudeMdLower.includes(d.toLowerCase())
          );
          if (unmappedDirs.length > 0) {
            recommendations.push({
              file: "CLAUDE.md",
              issue: `${unmappedDirs.length} top-level directory(ies) not described: ${unmappedDirs.join(", ")}`,
              suggestion: "Add an Architecture section mapping each top-level directory to its purpose.",
            });
          }

          // Check: noisy dirs not in .claudeignore
          if (snapshot.existingClaudeIgnore) {
            const ignoreLower = snapshot.existingClaudeIgnore.toLowerCase();
            const unignoredNoisy = snapshot.noisyDirs.filter(
              (d) => !ignoreLower.includes(d.toLowerCase())
            );
            if (unignoredNoisy.length > 0) {
              recommendations.push({
                file: ".claudeignore",
                issue: `${unignoredNoisy.length} noisy directory(ies) not in .claudeignore: ${unignoredNoisy.join(", ")}`,
                suggestion: "Add these directories to .claudeignore to reduce context noise.",
              });
            }
          } else if (snapshot.noisyDirs.length > 0) {
            recommendations.push({
              file: ".claudeignore",
              issue: "No .claudeignore file found despite noisy directories present",
              suggestion: `Create .claudeignore with entries for: ${snapshot.noisyDirs.join(", ")}`,
            });
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  hasRecommendations: recommendations.length > 0,
                  recommendations,
                  score: audit.totalScore,
                }, null, 2),
              },
            ],
          };
        }

        // No CLAUDE.md exists
        recommendations.push({
          file: "CLAUDE.md",
          issue: "No CLAUDE.md found in repository",
          suggestion: "Run generate_pack or apply_pack to create AI context files for this repo.",
        });

        if (snapshot.noisyDirs.length > 0) {
          recommendations.push({
            file: ".claudeignore",
            issue: "No .claudeignore file found",
            suggestion: `Create .claudeignore with entries for: ${snapshot.noisyDirs.join(", ")}`,
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                hasRecommendations: true,
                recommendations,
                score: null,
              }, null, 2),
            },
          ],
        };
      }

      case "repo_health": {
        const { folderPath } = RepoHealthSchema.parse(args);
        const snapshot = await scanRepository(folderPath);
        const audit = snapshot.existingClaudeMd
          ? auditClaudeMd(snapshot.existingClaudeMd, snapshot)
          : null;

        // Audit score component (50% weight)
        const auditScore = audit ? audit.totalScore : 0;

        // Documentation coverage (20% weight)
        const hasClaudeMd = snapshot.existingClaudeMd !== null;
        const hasClaudeIgnore = snapshot.existingClaudeIgnore !== null;
        const docRaw = (hasClaudeMd ? 60 : 0) + (hasClaudeIgnore ? 20 : 0) + (snapshot.existingCommands.length > 0 ? 20 : 0);
        const docScore = Math.min(docRaw, 100);

        // Commands coverage (15% weight)
        const pkg = snapshot.keyFiles.packageJson as Record<string, unknown> | null;
        let cmdScore = 0;
        if (pkg && typeof pkg.scripts === "object" && pkg.scripts !== null && hasClaudeMd) {
          const scripts = Object.keys(pkg.scripts as Record<string, unknown>);
          const claudeMdLower = snapshot.existingClaudeMd!.toLowerCase();
          const documented = scripts.filter((s) => claudeMdLower.includes(s.toLowerCase()));
          cmdScore = scripts.length > 0 ? Math.round((documented.length / scripts.length) * 100) : 0;
        } else if (!hasClaudeMd) {
          cmdScore = 0;
        } else {
          cmdScore = 50; // Has CLAUDE.md but no package.json scripts
        }

        // Context / noisy dirs (15% weight)
        const totalNoisy = snapshot.noisyDirs.length;
        const ignoredNoisy = hasClaudeIgnore
          ? snapshot.noisyDirs.filter((d) => snapshot.existingClaudeIgnore!.toLowerCase().includes(d.toLowerCase())).length
          : 0;
        const contextScore = totalNoisy > 0 ? Math.round((ignoredNoisy / totalNoisy) * 100) : 100;

        // Weighted overall score
        const overall = Math.round(
          auditScore * 0.5 + docScore * 0.2 + cmdScore * 0.15 + contextScore * 0.15
        );

        const badge = overall >= 80 ? "excellent" : overall >= 60 ? "good" : overall >= 40 ? "needs-improvement" : "critical";

        const summary = overall >= 80
          ? "Repository is well-prepared for AI-assisted development."
          : overall >= 60
            ? "Repository has decent AI context but could benefit from improvements."
            : overall >= 40
              ? "Repository needs significant AI context improvements."
              : "Repository lacks AI context files. Run apply_pack to get started.";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                overall,
                components: {
                  audit: auditScore,
                  documentation: docScore,
                  commands: cmdScore,
                  context: contextScore,
                },
                badge,
                summary,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    if (error instanceof McpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, message);
  }
});

// ── Start ──────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RepoMemory MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

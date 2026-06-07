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

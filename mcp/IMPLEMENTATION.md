# RepoMemory MCP Server — Implementation Plan

**Goal:** Expose RepoMemory scan/audit/generate/drift as MCP tools that Claude Code and OpenCode can call mid-session.

## Structure

```
mcp/
├── package.json          # Dependencies: @modelcontextprotocol/sdk, zod
├── tsconfig.json         # TypeScript config, references parent lib/
└── src/
    └── index.ts          # MCP server: tool registration + handlers
```

## Tools

| Tool | Description | Input | Output |
|---|---|---|---|
| `scan_repo` | Scan folder, return audit score + summary | `folderPath` | Score, dimensions, summary, detection info |
| `generate_pack` | Generate CLAUDE.md + .claudeignore + commands | `folderPath` | All generated files as structured content |
| `check_drift` | Compare current repo vs last scan | `folderPath` | Changed files, stale context files |
| `apply_pack` | Generate + write context files to repo | `folderPath` | List of written files |

## Build Steps

1. Create `mcp/package.json` with MCP SDK + zod
2. Create `mcp/tsconfig.json` pointing at parent `lib/`
3. Implement `mcp/src/index.ts`:
   - Import scanner, auditor, generator, drift from `../../lib/`
   - Register 4 tools with Zod schemas
   - Each handler calls the appropriate lib function and formats result
   - Connect via StdioServerTransport
4. Build and test locally
5. Document usage in README

## Implementation

The server loads lib modules by relative path (`../../lib/scanner` etc.).
Each tool handler is a thin wrapper around existing lib functions.

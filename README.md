# RepoMemory

**Project Intelligence Copilot for AI Coding Agents**

Scan any repository → audit its AI context quality → generate missing context files (CLAUDE.md, .claudeignore, commands, hooks) → detect drift when code changes but context doesn't.

Built for Claude Code, OpenCode, and any AI coding agent that uses project context files.

## How It Works

\`\`\`
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Pick a repo    │ ──→ │  Scan + Audit │ ──→ │  Generate Pack   │
│  (folder path)  │     │  Score 0-100  │     │  CLAUDE.md, etc  │
└─────────────────┘     └──────────────┘     └──────────────────┘
                                                   │
                                            ┌──────┴──────┐
                                            │  Export ZIP  │
                                            │  or apply    │
                                            └─────────────┘
\`\`\`

**Audit dimensions** (7 criteria, 0-100 total):
| Dimension | Max | What it checks |
|-----------|-----|----------------|
| Architecture | 15 | Folder structure, main modules, language/framework |
| Commands | 20 | Build, test, lint, run commands |
| Conventions | 15 | Coding style, naming, import rules |
| Off-limits | 15 | "Never touch" warnings (generated files, secrets) |
| Testing | 15 | Test workflow and runner |
| Deployment | 10 | CI/CD, staging, production |
| Freshness | 10 | References current deps and folder names |

## Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- An AI API key (OpenCode Go, OpenAI, or any OpenAI-compatible provider)

### Web App

\`\`\`bash
git clone https://github.com/yourusername/repomemory.git
cd repomemory
npm install
cp .env.example .env.local   # Edit with your API key
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000).

### CLI

\`\`\`bash
# From repo root:
npm run cli scan /path/to/repo
npm run cli generate /path/to/repo --apply
npm run cli check /path/to/repo

# Or install globally:
npm link
repomemory scan /path/to/repo --json
\`\`\`

### MCP Server

Add to \`opencode.json\` or \`claude_desktop_config.json\`:
\`\`\`json
{
  "mcpServers": {
    "repomemory": {
      "command": "npx",
      "args": ["tsx", "mcp/src/index.ts"],
      "cwd": "/path/to/repomemory"
    }
  }
}
\`\`\`

### Usage

1. Click **Scan** in the navigation
2. Enter the full path to a local repository
3. View the audit score across 7 dimensions
4. Click **Generate Context Pack** to create CLAUDE.md, .claudeignore, and commands
5. Download as ZIP

## Configuration

\`\`\`env
# Required: Your AI API key (OpenCode Go, OpenAI, etc.)
AI_PROVIDER_API_KEY=your_key_here

# Optional: Override the API endpoint
# AI_PROVIDER_BASE_URL=https://opencode.ai/zen/go/v1

# Optional: Override the model
# AI_MODEL=deepseek-v4-flash
\`\`\`

**Model recommendations:**
- \`deepseek-v4-flash\` — fast, cheap, good for .claudeignore and commands
- \`kimi-k2.6\` — best quality for CLAUDE.md generation

## MCP Server

RepoMemory includes an **MCP server** so Claude Code, OpenCode, and any MCP-compatible AI agent can call it mid-session.

### Tools

| Tool | Description |
|---|---|
| `scan_repo` | Scan a repo folder, return audit score (0-100) across 7 dimensions |
| `generate_pack` | Generate CLAUDE.md, .claudeignore, slash commands, pre-commit hook |
| `check_drift` | Compare current repo against last scan — detect stale context |
| `apply_pack` | Generate AND write context files directly to the repo |

### Usage in OpenCode

Add to your \`opencode.json\`:

\`\`\`json
{
  "mcpServers": {
    "repomemory": {
      "command": "npx",
      "args": ["tsx", "mcp/src/index.ts"],
      "cwd": "/path/to/repomemory"
    }
  }
}
\`\`\`

Or run directly:

\`\`\`bash
cd repomemory
npm run mcp
\`\`\`

### Usage in Claude Desktop

Add to \`claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "repomemory": {
      "command": "npx",
      "args": ["tsx", "mcp/src/index.ts"],
      "cwd": "/path/to/repomemory"
    }
  }
}
\`\`\`

Requires \`AI_PROVIDER_API_KEY\` in environment for generation tools.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Storage**: File-based JSON (\`.repomemory/store.json\`)
- **AI**: Pluggable — any OpenAI-compatible API
- **MCP**: \`@modelcontextprotocol/sdk\` — stdio transport

## Architecture

\`\`\`
repomemory/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard
│   ├── scan/page.tsx             # Scan a repo
│   ├── audit/[id]/page.tsx       # Audit results
│   └── api/                      # Route handlers
│       ├── scan/route.ts         # POST: scan a repo
│       ├── generate/route.ts     # POST: generate context pack
│       ├── projects/route.ts     # GET: list scanned projects
│       └── export/route.ts       # GET: download ZIP
├── lib/                          # Core modules
│   ├── types.ts                  # Shared TypeScript types
│   ├── storage.ts                # File-based persistence
│   ├── scanner.ts                # Repo traversal & metadata
│   ├── auditor.ts                # CLAUDE.md quality scoring
│   ├── ai.ts                     # OpenAI-compatible API wrapper
│   ├── prompts.ts                # AI prompt templates
│   ├── generator.ts              # Context pack generation
│   ├── drift.ts                  # Drift detection
│   └── export.ts                 # ZIP export
├── components/                   # UI components
│   ├── ScoreCard.tsx             # Score gauge per dimension
│   ├── FilePreview.tsx           # Generated file preview
│   ├── DriftAlert.tsx            # Drift warning banner
│   ├── FolderPicker.tsx          # Folder path input
│   └── ExportButton.tsx          # ZIP download button
├── mcp/                          # MCP server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/index.ts              # Server: 4 MCP tools
└── .env.example
\`\`\`

## License

MIT

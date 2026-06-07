<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://repomemory.dev/og-dark.png">
  <img alt="RepoMemory — Project Intelligence Copilot for AI Coding Agents" src="https://repomemory.dev/og.png">
</picture>

# RepoMemory

**Scan → Audit → Generate → Monitor → Detect Drift → Repair — automatically.**

RepoMemory is a project intelligence platform for AI coding agents. It scans any repository, audits the quality of AI context files (CLAUDE.md, AGENTS.md, CURSOR.md, GEMINI.md, etc.), generates missing context, detects drift when code changes but context doesn't, and keeps your AI agents informed.

[![CI](https://github.com/PraveenJayaprakash-JP/repomemory/actions/workflows/ci.yml/badge.svg)](https://github.com/PraveenJayaprakash-JP/repomemory/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![AI Readiness](https://img.shields.io/badge/AI_Readiness-87%25-green)](https://github.com/PraveenJayaprakash-JP/repomemory)

---

## Features

| | Feature | Description |
|---|---|---|
| 🔍 | **Multi-Agent Audit** | Scores context files across 7 quality dimensions for Claude, Cursor, Windsurf, Gemini, OpenCode, Aider |
| 🎯 | **Quality Suggestions** | Actionable fix steps per dimension — not just scores |
| 📝 | **Context Generation** | Generates CLAUDE.md, AGENTS.md, CURSOR.md, GEMINI.md, AIDER.md, .claudeignore, commands, hooks |
| 🔄 | **Smart Regeneration** | Detects changed sections, regenerates only what's needed |
| ⚡ | **One-Click Fix** | Generate + apply all context files in one click |
| 👁️ | **Drift Detection** | Alerts when code changes but context files don't update |
| 📊 | **Score Timeline** | Track context quality over time with interactive charts |
| 🔬 | **Scan Comparison** | Side-by-side diff of audit scores between scans |
| 🏗️ | **Architecture Graph** | Visual dependency map of your repository |
| 🏷️ | **README Badge** | Shields.io-style AI Readiness badge for your repo |
| 📋 | **Change Summaries** | AI-generated git commit summaries for agent context |
| 🤖 | **MCP Server** | 7 tools for AI agents: scan, generate, drift, explain, suggest, health |

## Quick Start

### Web App

```bash
git clone https://github.com/PraveenJayaprakash-JP/repomemory.git
cd repomemory
npm install
cp .env.example .env.local   # Add your AI provider API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### CLI

```bash
npm run cli scan /path/to/repo
npm run cli generate /path/to/repo --apply
npm run cli check /path/to/repo
```

### MCP Server

Add to your `opencode.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "repomemory": {
      "command": "npx",
      "args": ["tsx", "mcp/src/index.ts"],
      "cwd": "/path/to/repomemory"
    }
  }
}
```

### VS Code Extension

1. Open the `vscode/` folder in VS Code
2. Press `F5` to start debugging
3. Use the RepoMemory sidebar panel

## Configuration

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER_API_KEY` | — | API key for AI provider (OpenCode Go, OpenAI, etc.) |
| `AI_PROVIDER_BASE_URL` | `https://opencode.ai/zen/go/v1` | OpenAI-compatible API endpoint |
| `AI_MODEL` | `deepseek-v4-flash` | Model for generation tasks |

## Architecture

```
repomemory/
├── app/              # Next.js 15 web app (dashboard, scan, audit, compare)
├── lib/              # Core modules (scanner, auditor, generator, AI, drift, graph)
├── components/       # UI components (ScoreCard, ArchGraph, Timeline, etc.)
├── cli/              # CLI tool (scan, generate, check commands)
├── mcp/              # MCP server (7 tools for AI agents)
├── vscode/           # VS Code extension (sidebar + webview)
└── tests/            # 24 unit tests
```

### Data Flow

```
Repository → Scanner → Auditor → Generator → Apply
                  ↓                      ↓
            Drift Detection       Smart Regeneration
                  ↓                      ↓
            Timeline + Compare    Change Summaries
```

## CI Integration

Add to your GitHub Actions workflow:

```yaml
- uses: PraveenJayaprakash-JP/repomemory/.github/actions/repomemory-check@main
  with:
    ai-api-key: ${{ secrets.AI_PROVIDER_API_KEY }}
```

This checks every PR for context drift and posts a comment when context files need updating.

## Development

```bash
npm test              # Run tests (24 tests)
npm run build         # Production build (2.5s)
npm run cli -- scan . # Scan this repo
```

## License

MIT

<div align="center">
  <h1>🧠 RepoMemory</h1>
  <p><strong>Project Intelligence Platform for AI Coding Agents</strong></p>
  <p><em>SonarQube for AI Coding Agents — Scan → Audit → Generate → Monitor → Detect Drift → Repair → Learn</em></p>

  <p>
    <a href="https://github.com/PraveenJayaprakash-JP/repomemory/actions"><img src="https://img.shields.io/github/actions/workflow/status/PraveenJayaprakash-JP/repomemory/ci.yml?branch=master&style=flat-square&label=CI" alt="CI"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome">
  </p>

  <br>

  <img src="https://raw.githubusercontent.com/PraveenJayaprakash-JP/repomemory/master/public/screenshots/audit-results.png" alt="RepoMemory" width="800">

  <br>
  <br>

  <p>
    <b>Web App</b> ⋅
    <b>CLI</b> ⋅
    <b>MCP Server</b> ⋅
    <b>VS Code Extension</b> ⋅
    <b>GitHub Action</b>
  </p>

  <br>
</div>

---

## 🎯 The Problem

AI coding agents are only as good as the context they receive. Yet the files that control that context — `CLAUDE.md`, `.claudeignore`, `AGENTS.md`, `CURSOR.md` — are maintained manually, inconsistently, and with no tooling support. When your code evolves but your context files don't, your AI agent works with outdated information.

**RepoMemory solves this.** It's the first tool that treats AI context quality as a product — automatically scanning, auditing, generating, and monitoring the intelligence layer of your repositories.

---

## ✨ Features

### 🔍 Multi-Agent Audit
Score your AI context files across **7 quality dimensions** (Architecture, Commands, Conventions, Off-limits, Testing, Deployment, Freshness) for **6 AI coding agents**:

| Agent | File | Score |
|-------|------|-------|
| <img src="https://img.shields.io/badge/Claude-000?style=flat-square&logo=anthropic&logoColor=white" height="20"> | `CLAUDE.md` | 0–100 |
| <img src="https://img.shields.io/badge/Cursor-000?style=flat-square&logo=cursor&logoColor=white" height="20"> | `.cursor/rules.mdc` | 0–100 |
| <img src="https://img.shields.io/badge/Windsurf-000?style=flat-square&logo=windsurf&logoColor=white" height="20"> | `.windsurf/rules.md` | 0–100 |
| <img src="https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=google&logoColor=white" height="20"> | `GEMINI.md` | 0–100 |
| <img src="https://img.shields.io/badge/OpenCode-000?style=flat-square&logo=openai&logoColor=white" height="20"> | `AGENTS.md` | 0–100 |
| <img src="https://img.shields.io/badge/Aider-000?style=flat-square&logo=python&logoColor=white" height="20"> | `AIDER.md` | 0–100 |

### 🧠 Core Capabilities

<table>
  <tr>
    <td width="50%">
      <h4>📝 Context Generation</h4>
      <p>Generate complete AI context packs for all major coding agents — CLAUDE.md, AGENTS.md, CURSOR.md, GEMINI.md, AIDER.md, .claudeignore, slash commands, and git hooks.</p>
    </td>
    <td width="50%">
      <h4>🎯 Quality Suggestions</h4>
      <p>Not just scores — actionable fix steps per dimension. "Add a `## Commands` section listing: `npm run dev`, `npm run build`, `npm test`."</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🔄 Smart Regeneration</h4>
      <p>Detects which sections of your context files changed (new dependencies, new directories, config changes) and regenerates only what's needed — not the entire file.</p>
    </td>
    <td width="50%">
      <h4>⚡ One-Click Fix</h4>
      <p>Single button to generate + apply all context files. From zero to fully documented in one click.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>👁️ Advanced Drift Detection</h4>
      <p>Git-aware analysis with risk scoring (low/medium/high/critical), per-file risk assessment, and repair suggestions. Knows when your code outgrew your context.</p>
    </td>
    <td width="50%">
      <h4>🏗️ Architecture Discovery Engine</h4>
      <p>Automatically discovers modules, services, data flows, and tech stack. Generates architecture reports, dependency maps, and service relationship diagrams.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>📊 Score Timeline & Comparison</h4>
      <p>Track context quality over time with interactive charts. Compare any two scans side-by-side to see which dimensions improved or regressed.</p>
    </td>
    <td width="50%">
      <h4>🏷️ Repository Badge</h4>
      <p>Shields.io-style AI Readiness badge for your README. Show the world your project is AI-ready.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>📋 Change Summaries</h4>
      <p>AI-generated summaries of recent git commits for agent context. Keeps AI agents informed about what changed without reading full diffs.</p>
    </td>
    <td width="50%">
      <h4>📝 ADR Generator</h4>
      <p>Automatically creates Architecture Decision Records from git history, dependency changes, and config changes. Preserves engineering decisions in `adr/` directory.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h4>🧠 Project Brain</h4>
      <p>Persistent knowledge store for your repository — decisions, lessons learned, technical debt, and known bugs. Stored in `.repomemory/brain/` and accessible to AI agents.</p>
    </td>
    <td width="50%">
      <h4>🤖 MCP Server (8 tools)</h4>
      <p>Expose RepoMemory as MCP tools: scan, generate, drift, apply, explain, suggest, health, explain_codebase. Any MCP-compatible AI agent can call them mid-session.</p>
    </td>
  </tr>
</table>

### 🔌 Integrations

| Interface | What it does | Quick Start |
|-----------|-------------|-------------|
| 🌐 **Web App** | Full-featured dashboard with scan, audit, generate, compare | `npm run dev → localhost:3000\n\n**Live demo:** [repomemory-omega.vercel.app](https://repomemory-omega.vercel.app) |
| 💻 **CLI** | Run scans, generate, and check from terminal | `npm run cli scan .` |
| 🤖 **MCP Server** | Call RepoMemory tools from any AI agent | 8 tools, stdio transport |
| 🖥️ **VS Code** | Sidebar panel with project tree + webview audit | Open `vscode/`, F5 |
| 🔄 **GitHub Action** | Auto-check PRs for context drift | `uses: ./github/actions/repomemory-check` |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/PraveenJayaprakash-JP/repomemory.git
cd repomemory

# Install & configure
npm install
cp .env.example .env.local   # Add your AI API key

# Start the web app
npm run dev → localhost:3000\n\n**Live demo:** [repomemory-omega.vercel.app](https://repomemory-omega.vercel.app)

# Or use the CLI
npm run cli scan /path/to/your/repo
npm run cli generate /path/to/your/repo --apply
```

### 🐳 One-Click Fix
```bash
# Generate + apply all context files in one command
npm run cli generate /path/to/repo --apply
```

### 🤖 MCP for AI Agents

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

**Available MCP tools:**

| Tool | Description |
|------|-------------|
| `scan_repo` | Scan + audit a repo folder |
| `generate_pack` | Generate context files via AI |
| `check_drift` | Detect stale context |
| `apply_pack` | Generate + write to repo |
| `explain_repo` | Explain repo architecture |
| `suggest_context_updates` | Get recommendations |
| `repo_health` | Overall health score |
| `explain_codebase` | Comprehensive codebase explanation |

---

## 📸 Screenshots

<div align="center">
  <table>
    <tr>
      <td><img src="https://raw.githubusercontent.com/PraveenJayaprakash-JP/repomemory/master/public/screenshots/dashboard.png" alt="Dashboard" width="400"></td>
      <td><img src="https://raw.githubusercontent.com/PraveenJayaprakash-JP/repomemory/master/public/screenshots/scan.png" alt="Scan Page" width="400"></td>
    </tr>
    <tr>
      <td align="center"><b>Dashboard</b> — scan history & score timeline</td>
      <td align="center"><b>Scan Page</b> — repo scanner & folder picker</td>
    </tr>
    <tr>
      <td colspan="2"><img src="https://raw.githubusercontent.com/PraveenJayaprakash-JP/repomemory/master/public/screenshots/audit-results.png" alt="Audit Results" width="800"></td>
    </tr>
    <tr>
      <td colspan="2" align="center"><b>Audit Results</b> — 7-dimension score, quality suggestions, architecture graph</td>
    </tr>
  </table>
</div>

---

## ⚙️ Configuration

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER_API_KEY` | — | Your AI provider API key |
| `AI_PROVIDER_BASE_URL` | `https://opencode.ai/zen/go/v1` | OpenAI-compatible endpoint |
| `AI_MODEL` | `deepseek-v4-flash` | Model for generation tasks |

---

## 🏗️ Architecture

```
repomemory/
├── app/              # Next.js 15 — 15 routes across 7 pages
├── lib/              # 15 core modules
│   ├── scanner.ts    # File system traversal + detection
│   ├── auditor.ts    # 7-dimension quality scoring
│   ├── generator.ts  # AI context pack generation
│   ├── drift.ts      # Drift detection + risk scoring
│   ├── graph.ts      # Architecture graph builder
│   ├── discovery.ts  # Deep architecture discovery
│   ├── adr.ts        # ADR generation from git history
│   ├── brain.ts      # Persistent knowledge store
│   ├── changelog.ts  # Git change summaries
│   ├── ai.ts         # OpenAI-compatible API wrapper
│   ├── prompts.ts    # AI prompt templates
│   ├── storage.ts    # File-based persistence
│   ├── export.ts     # ZIP export
│   └── types.ts      # Shared TypeScript types
├── cli/              # CLI tool (3 commands)
├── mcp/              # MCP server (8 tools)
├── vscode/           # VS Code extension
├── .github/          # GitHub Action + CI workflow
└── tests/            # 24 unit tests
```

---

## 🔄 CI Integration

Add to your GitHub Actions workflow:

```yaml
- name: Check AI Context
  uses: PraveenJayaprakash-JP/repomemory/.github/actions/repomemory-check@main
  with:
    ai-api-key: ${{ secrets.AI_PROVIDER_API_KEY }}
    fail-on-drift: true
    min-score: 60
```

This checks every PR for:
- ✅ AI Readiness score
- ✅ Context drift detection
- ✅ Risk level assessment
- ✅ Automatic PR comments with findings
- ✅ CI/CD enforcement (optional min-score gate)

---

## 🛠️ Development

```bash
npm test              # 24 unit tests
npm run build         # Production build (2.5s, 16 routes)
npm run cli -- scan . # Scan this repo
npm run cli -- generate . --apply  # Generate context for this repo
```

---

## 🗺️ Roadmap

- [x] Multi-agent context generation (6 AI agents)
- [x] Advanced drift detection with risk scoring
- [x] Architecture discovery engine
- [x] ADR generator
- [x] Project Brain (persistent knowledge)
- [x] explain_codebase MCP tool
- [ ] Public hosted version
- [ ] Team dashboard with multi-repo support
- [ ] VSCode marketplace release
- [ ] GitHub marketplace action

---

## 🤝 Contributing

PRs welcome! RepoMemory is built with OpenCode Go — the same AI coding agent it helps configure.

1. Fork the repo
2. Create your feature branch: `git checkout -b feat/amazing`
3. Commit: `git commit -m 'feat: add amazing feature'`
4. Push: `git push origin feat/amazing`
5. Open a PR

---

## 📄 License

MIT © [PraveenJayaprakash-JP](https://github.com/PraveenJayaprakash-JP)

---

<div align="center">
  <p><strong>⭐ Star us on GitHub — it helps more developers discover RepoMemory</strong></p>
  <p>
    <a href="https://github.com/PraveenJayaprakash-JP/repomemory">GitHub</a> ⋅
    <a href="https://github.com/PraveenJayaprakash-JP/repomemory/issues">Issues</a> ⋅
    <a href="https://github.com/PraveenJayaprakash-JP/repomemory/discussions">Discussions</a>
  </p>
</div>



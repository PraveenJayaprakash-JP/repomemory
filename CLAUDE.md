# CLAUDE.md — repomemory

## Project Overview

Repomemory is a monorepo toolset for auditing, visualizing, and documenting codebase structure. It combines filesystem scanning, dependency graph analysis, and LLM‑powered audit generation. The project provides four interfaces:

- **Next.js web app** – Browse and explore audit reports interactively.
- **CLI** – Run scans and audits from the terminal.
- **MCP server** – Expose scanning/auditing as tools for AI protocols (Model Context Protocol).
- **VS Code extension** – Integrate repository memory directly into the editor.

Core value: generate a living “memory” of a repository’s architecture that can be queried, visualized, and updated.

## Architecture

```
repomemory/
├─ app/                    # Next.js App Router pages
│  ├─ audit/[id]/page.tsx  # Individual audit report view
│  └─ scan/page.tsx        # Scan interface
├─ cli/                    # Command‑line interface package
│  ├─ package.json
│  └─ package-lock.json
├─ components/             # Shared React components
│  └─ ArchGraph.tsx        # Dependency graph visualization
├─ lib/                    # Core libraries (TypeScript source)
│  ├─ scanner.ts           # File & dependency scanner
│  ├─ auditor.ts           # LLM‑based audit generation
│  ├─ graph.ts             # Dependency graph builder
│  ├─ generator.ts         # Output report orchestrator
│  └─ prompts.ts           # LLM prompt templates
├─ mcp/                    # MCP server package
│  ├─ src/index.ts         # Server entry point
│  └─ package-lock.json
├─ vscode/                 # VS Code extension package
│  ├─ out/                 # Compiled extension (generated)
│  │  └─ extension.js
│  └─ package-lock.json
├─ tsconfig.tsbuildinfo    # TypeScript incremental build info (generated)
├─ package.json
└─ package-lock.json
```

**Data flow**  
`lib/scanner.ts` → walks filesystem, extracts files and imports → `lib/graph.ts` builds dependency DAG → `lib/auditor.ts` (using prompts from `lib/prompts.ts`) sends structure to LLM → `lib/generator.ts` assembles audit markdown → stored and served by Next.js layers.  
Each interface (cli, mcp, vscode) imports from `lib/` directly.

**Key abstractions**  
- `Scanner` – configurable file tree walker with import resolution.  
- `Auditor` – orchestrates LLM calls; audit result is a plain markdown string with structured metadata.  
- `Graph` – adjacency list of dependencies, serializable to D3‑compatible format.  
- `Generator` – takes scanner + auditor output, produces a final report artifact.

## Commands

All commands assume `npm` is the package manager. Each sub‑package has its own `package.json` and must be run from its own directory.

### Root (Next.js web app)
```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Production build (Next.js)
npm run start        # Start production server
npm run lint         # ESLint on `app/`, `components/`, `lib/`
```

### CLI (`cli/`)
```bash
npm run build        # Compile CLI binary (tsc → dist/)
npm run start -- <args>   # Run the CLI tool
```

### MCP server (`mcp/`)
```bash
npm run build        # Compile TypeScript (tsc)
npm run start        # Start MCP server (stdio or TCP)
```

### VS Code extension (`vscode/`)
```bash
npm run compile      # Compile TypeScript → out/
npm run watch        # Watch mode
```
*(Extension is loaded from `out/` by VSCode; to develop, launch the extension host via `F5`.)*

All packages use `tsc` for compilation; there is no global `npm test` at root (tests live per‑package).

## Conventions

- **TypeScript** – strict mode everywhere.  
- **Naming**  
  - Components: PascalCase (e.g. `ArchGraph.tsx`).  
  - Functions/utilities: camelCase.  
  - Files: kebab-case for libraries, PascalCase for components.  
- **Imports** – order: external modules → `@/lib/*` → relative `./`. No default exports unless required by Next.js (pages).  
- **Formatting** – standard `eslint` + `prettier` (config at root). Run `npm run lint` before commits.  
- **Commits** – conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.  
- **Branches** – feature branches off `main`: `feature/<short-description>`. No long‑lived branches.  
- **Generated files** – never commit changes to `dist/`, `out/`, `.tsbuildinfo`, `*.js` (compiled), `*.js.map`, `package-lock.json` (auto‑generated, but committed as a snapshot).

## Off‑Limits

The following files/directories must **never** be modified:

- `tsconfig.tsbuildinfo` – TypeScript incremental build metadata.  
- `package-lock.json` – in any directory (root, cli, mcp, vscode).  
- `lib/*.js` and `lib/*.js.map` – compiled JavaScript and source maps (source is `.ts`).  
- `vscode/out/` – entire directory (compiled extension output).  
- `.map` files everywhere.  

If you need to update dependencies, edit the corresponding `package.json` and run `npm install` – the lockfile will be regenerated.

## Testing

Testing is organised per package. No root‑level test runner.

### CLI (`cli/`)
```bash
npm test             # Jest tests (if present)
```

### MCP (`mcp/`)
```bash
npm test             # Jest or Vitest
```

### VS Code extension (`vscode/`)
```bash
npm test             # Runs VS Code extension tests (requires `code` binary)
```

**Coverage expectations** – all new code in `lib/` should have accompanying tests in the package that uses it. Patch‑level coverage ≥ 80% for logic modules (`scanner.ts`, `graph.ts`, `auditor.ts`).  
**Pattern** – prefer integration tests that exercise full data flow (scanner → graph → auditor) with fixture repos under `test/fixtures/`.

## Deployment

### Next.js web app
```bash
npm run build        # Produces .next/ folder
```
Deploy to **Vercel** (default for Next.js). Environment variables (if any) are set in Vercel dashboard. No specific env vars required for basic operation.

### CLI
Build with `npm run build` in `cli/` → publish to npm (`npm publish` from `cli/`).

### MCP server
Build and run as a long‑lived process. Can be containerised with a minimal Node.js image. Expose via stdio or TCP port (configured in `mcp/src/index.ts`).

### VS Code extension
Package with `vsce package` from `vscode/` → publish to Marketplace via `vsce publish`.

**CI/CD** – GitHub Actions (inferred). Workflow file at `.github/workflows/ci.yml` (not listed, assume it exists). Runs `npm run build` and `npm test` for changed packages on pull requests to `main`.
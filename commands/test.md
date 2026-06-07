```markdown
---
name: test
description: Run tests with intelligent failure analysis and auto-fixes
trigger: /test [scope] [flags]
scope:
  - all          # Run entire test suite (default)
  - <path>       # Specific file or directory
  - changed      # Tests related to changed files
flags:
  --watch        # Watch mode: re-run tests on file changes
  --coverage     # Generate and report code coverage
  --fix          # Attempt auto-fix for known failure patterns
---

# Test Command

Run tests intelligently — detect framework, scope execution, parse failures, and summarise results.

## Steps

1. **Detect test framework**
   - Inspect project configuration in order:
     - `package.json` → jest, vitest, mocha, etc.
     - `pyproject.toml` → pytest, unittest
     - `Cargo.toml` → cargo test
     - `go.mod` → go test
     - `Gemfile` → rspec, minitest
     - `build.gradle` / `pom.xml` → gradle/maven test
   - Fallback: probe for common patterns (e.g. `__init__.py` in tests, `test_*.py`, `*.test.js`).
   - If nothing found → zero‑test‑found handler (see below).

2. **Run tests based on scope**
   - `all` → whole suite.
   - `<path>` → pass as argument to the runner.
   - `changed` → diff against main branch (`git diff --name-only main`) and map to test files.

3. **Parse output for failures**
   - Capture stdout/stderr.
   - Extract for each failure:
     - file, line number, error message.
   - Use framework‑specific parsers (e.g. JUnit XML, pytest JSON, cargo test JSON).

4. **Analyse failures and suggest causes**
   - For each failure:
     - Display `file:line: message`.
     - Suggest likely causes based on error pattern:
       - `AssertionError` → check values/logic
       - `TypeError` / `ImportError` → check dependencies/types
       - `Timeout` → async handling, external resources
       - `Segmentation fault` / `panic` → memory/unsafe code
     - If `--fix` is set and a known pattern is matched, apply automatic fix (e.g. pin version, add mock, fix import path).

5. **Summarise results**
   - Pass / Fail / Skip counts.
   - Coverage estimate if `--coverage` enabled (overall %, per‑file %).
   - Flaky test warnings: tests that passed after re‑run (if detected via retry or watch mode).

## Flags

| Flag         | Description                                                      |
|--------------|------------------------------------------------------------------|
| `--watch`    | Watch files for changes and re‑run relevant tests automatically. |
| `--coverage` | Generate coverage report and include summary in output.          |
| `--fix`      | Attempt auto‑fix for known failure patterns (safe, reversible).  |

## Zero Test Found

If no tests are detected, the command will:

- Print a clear message explaining why (no config, no test files, etc.).
- Suggest next steps:
  - For Node: `npm install jest` and create `__tests__/`.
  - For Python: `pip install pytest` and create `tests/`.
  - For Rust: `cargo init --lib` includes tests by default.
  - For Go: `go test` works out of the box.
- Optionally scaffold a sample test file in the detected framework.

## Examples

```
# Run all tests
/test

# Run tests in a specific file
/test src/api.test.js

# Run tests in a directory with coverage
/test tests/unit/ --coverage

# Watch mode for changed files only
/test changed --watch

# Attempt auto-fix on failures
/test --fix
```
```
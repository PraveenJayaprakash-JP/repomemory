# /review

## Description
Performs a structured code review on unstaged/staged changes (`git diff`) or a specified file/scope. Runs consistency checks against project conventions (`CLAUDE.md`) and outputs findings with severity levels.

## Usage
```
/review                     # Reviews all unstaged/staged changes
/review <file-or-scope>     # Reviews a specific file or directory
```

## Options
| Flag        | Description                                                                 |
|-------------|-----------------------------------------------------------------------------|
| `--full`    | Deep review: checks code complexity, dependency patterns, test coverage gaps|
| `--quick`   | Surface review: only checks naming, formatting, obvious antipatterns        |
| `--security`| Security-focused: skips style/performance, deep-dives on OWASP Top 10       |

Flags can be combined.  
`/review --security --full` runs both security checks and deep analysis.

## Process
The review follows these steps:

1. **Identify scope** – Runs `git diff` (cached + unstaged) for unspecified scope; uses `git diff -- <file-or-scope>` if a path is given.
2. **Run check categories** (adjusted by flags):
   - Security: injection, XSS, auth mistakes, secret leaks, unsafe deserialization, path traversal.
   - Performance: unnecessary allocations, missing memoization, sync IO in hot paths, large loops.
   - Type safety: missing `strict` enforcement, `any` usage, unsafe type assertions, misuse of generics.
   - Error handling: swallowed errors, bare try/catch, missing error boundaries, improper error propagation.
3. **Verify conventions** – Read `<workspace>/CLAUDE.md` if it exists; flag deviations in naming, module structure, export style, comment expectations.
4. **Classify findings** – Each finding gets a severity:
   - `critical` – Bug, security vulnerability, or definite crash.
   - `warning` – Likely issue or convention violation.
   - `info` – Suggestion or minor improvement.
5. **Suggest fixes** – Provide exact file:line references and concrete code snippets for critical and warning findings.

## Output Format
```markdown
## /path/to/file.ts

| Line | Severity | Issue                                                                 |
|------|----------|-----------------------------------------------------------------------|
| 42   | critical | SQL injection: raw interpolation of user input in query string.       |
| 67   | warning  | Exported function lacks JSDoc; CLAUDE.md requires documentation.       |
| 89   | info     | Long function (120 lines) consider extracting helper.                  |
```

Additional suggestion blocks are appended for critical/warning items.

## Examples

**Review all changes (quick)**
```
/review --quick
```

**Deep review of a single file**
```
/review src/auth.ts --full
```

**Security check on a directory**
```
/review src/api/ --security
```

**Quick security review for current changes**
```
/review --quick --security
```

## Notes
- The command respects `.gitignore` and will not review binary files.
- If `CLAUDE.md` is absent, conventions are not checked; a warning is printed.
- For the full list of checks and severity criteria, see `.claude/rules/` (if present).
- Use `/review --full` before merging into main to catch deeper issues.
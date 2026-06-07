# Sample Repo

## Architecture
The project uses src/ directory with TypeScript.
Main modules: src/index.ts

## Commands
- dev: next dev
- build: next build
- test: jest
- lint: eslint
- start: next start

## Conventions
TypeScript strict mode. ESLint for linting.

## Testing
Run tests with jest. Tests are in src/__tests__/.

## Deployment
CI/CD via GitHub Actions.

## Off-limits
Do not modify generated files in dist/ or .next/.
Secrets are in .env.local — never commit.

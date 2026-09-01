# AGENTS.md

## Project context

- This is a NestJS v12+ backend written in TypeScript and configured as an ECMAScript Modules (ESM) project.
- Use Node.js v26 only. The required version is defined in `.nvmrc`.
- Preserve the existing ESM and TypeScript configuration (`module` and `moduleResolution` set to `nodenext`, with strict type checking enabled).

## Implementation guidelines

- Follow NestJS conventions: keep modules, controllers, services, DTOs, guards, pipes, and providers focused on one responsibility.
- Prefer clear, typed, and small units of code over clever abstractions. Do not introduce abstractions without a concrete reuse need.
- Keep changes scoped to the request. Avoid unrelated refactors, dependency upgrades, and generated-file changes.
- Reuse existing patterns and dependencies before adding new packages.
- Never expose secrets, tokens, credentials, or private data. Use environment variables for configuration and keep real `.env` files out of version control.

## Quality, security, and performance

- Apply DRY principles while avoiding premature abstraction.
- Keep cyclomatic complexity low: extract well-named private methods or services when branching becomes difficult to understand or test.
- Validate and sanitize external input; use DTOs and NestJS validation mechanisms for API boundaries.
- Treat authorization, authentication, error responses, logging, and sensitive data as security-sensitive areas.
- Prefer efficient data access, avoid unnecessary work in request paths, and consider memory and latency implications when handling large inputs or collections.

## Validation

- Add or update focused tests for changed behavior. Run end-to-end tests when HTTP behavior is affected.
- Before considering work complete, run the relevant checks:
  - `npm run lint`
  - `npm test`
  - `npm run build`

## Git workflow

- At the end of every implementation, provide a concise commit message in English.
- Never create a commit or push changes unless the user explicitly requests it.
- Before a requested commit, review the staged diff and ensure it contains only intended changes.

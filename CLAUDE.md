# Claude Code Guidelines

This file contains guidelines and rules for Claude Code when working on this project.

## Development Workflow Rules

### Git Commit Workflow
- **Always commit current changes first before adding more new changes**
  - When multiple features or fixes are being worked on, complete and commit the current changes before starting new work
  - This keeps the git history clean and makes it easier to track individual changes
  - Each commit should represent a complete, logical unit of work

## Project-Specific Guidelines

### Code Style
- Use TypeScript without transpilation (see ADR 0004)
- Follow Web Components patterns (see ADR 0001)
- Use URL as the single source of truth for state (see ADR 0002)

### UI/UX Principles
- Minimize visual noise and distractions
- Use progressive disclosure (hide details until needed)
- Prefer manual save actions over auto-save for user control
- Keep forms simple and focused

### File Organization
- Components go in `src/components/`
- Models go in `src/models/`
- Utilities go in `src/utils/`
- Architecture Decision Records (ADRs) go in `docs/adr/`

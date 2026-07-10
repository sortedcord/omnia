# Contributing to Omnia

Thank you for your interest in contributing to Omnia! We welcome contributions from developers, technical writers, and anyone interested in agentic narrative simulation.

Please take a moment to review this document before submitting contributions.

## Table of Contents

1. [Documentation](#documentation)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Pull Request Guidelines](#pull-request-guidelines)

## Documentation

The primary source of truth for the Omnia project is the official documentation:
👉 **[Omnia Documentation](https://omnia.adityagupta.dev/docs)**

Please refer to the documentation to understand the project architecture, memory model, spatial systems, intents framework, and custom LLM configurations.

## Getting Started

Omnia is organized as a monorepo managed with **pnpm** workspaces.

### Prerequisites

- **Node.js** (v22.13 or newer recommended)
- **pnpm** (v11 or newer recommended)

### Local Setup

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/omnia-consolidated.git
   cd omnia-consolidated
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the Web GUI interface locally:
   ```bash
   pnpm dev:gui
   ```
4. Run the Starlight documentation site locally:
   ```bash
   pnpm dev:docs
   ```

## Development Workflow

### Branching

Create a descriptive branch for your changes:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### Running Tests

Make sure all unit tests pass before submitting changes:

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Linting and Formatting

We enforce consistent code quality and formatting rules across the repository.

```bash
# Check code style and formatting
pnpm lint
pnpm format:check

# Auto-fix code style issues
pnpm lint:fix
pnpm format
```

## Coding Standards

- **TypeScript**: Omnia is written entirely in TypeScript. Ensure all new code is strongly typed.
- **Docstrings**: Document public-facing APIs, methods, and configurations.

## Pull Request Guidelines

1. **Keep PRs Focused**: Keep your changes as small and focused as possible.
2. **Include Tests**: If you are introducing a new feature or fixing a bug, write corresponding tests in `tests/`.
3. **Update Documentation**: If your changes alter public behavior or introduce new APIs, update the docs under `web/docs/src/content/docs/`.
4. **Follow Commit Conventions**: Write clear, descriptive commit messages.

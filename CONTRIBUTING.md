# Contributing to Scribblitz 🎨

First off, thank you for considering contributing to Scribblitz! It's people like you that make the open-source community such a fantastic place to learn, inspire, and create.

## 🧠 Project Architecture Overview

Before diving in, please review the **Architecture Overview** in our [README.md](README.md) to understand how our Turborepo is structured, how the Finite State Machine (FSM) works, and how our `@scribblitz/types` shared contract operates.

## 🛠️ Local Development

To get the project running locally:

1. Ensure you have **Node.js 24.16.0** (or run `nvm use`), **pnpm 11.5.3**, and **Docker** installed.
2. Fork and clone the repository.
3. Run `pnpm install` at the root.
4. Follow the **Local Setup** guide in the `README.md` to configure your `.env` file and start the Docker containers (Postgres & Redis).
5. Run `pnpm dev` to start the web client, game server, and worker simultaneously.

## 📝 Pull Request Process

1. **Branch Naming:** Create a branch from `main` using a descriptive format: `feature/your-feature-name`, `fix/your-bug-fix`, or `docs/update-readme`.
2. **Commit Messages:** We follow [Conventional Commits](https://www.conventionalcommits.org/). Please use prefixes like `feat:`, `fix:`, `chore:`, or `docs:`.
3. **Type Safety:** Scribblitz heavily relies on strict TypeScript contracts. Ensure your code passes all type checks by running `pnpm build` before submitting a PR.
4. **Linting:** Run `pnpm lint` to ensure your code matches the project's formatting standards.
5. **Describe Your Changes:** When opening a PR, clearly explain what you changed, why you changed it, and include screenshots or GIFs if you modified the UI.

## 🐛 Reporting Bugs

If you find a bug, please open an issue and include:
- Your operating system and browser.
- Steps to reproduce the bug.
- Any relevant console errors or server logs.

I appreciate your help in making Scribblitz better!

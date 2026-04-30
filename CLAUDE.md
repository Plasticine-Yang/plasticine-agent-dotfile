# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm build` — build the CLI with rolldown into `dist/cli.js`
- `pnpm typecheck` — run TypeScript type checking with `tsc --noEmit`
- `pnpm test` — run the Vitest suite
- `pnpm test -- tests/install.test.ts` — run a single test file with Vitest
- `pnpm test -- tests/install.test.ts -t "builds both skill and plugin commands from config"` — run a single named test
- `pnpm exec plasticine-agent-dotfile <command>` — run the CLI locally through the package manager

## Runtime shape

This repository builds a Node.js CLI with two user-facing entry names defined in `package.json`:
- `plasticine-agent-dotfile`
- `pad`

The compiled entrypoint is `dist/cli.js`, built from `src/cli.ts`.

## High-level architecture

### Command layer

`src/cli.ts` is the orchestration layer. It defines the Commander command tree and wires subcommands to the config, prompt, and install modules.

There are three main command families:
- `init` — creates the default local config file in the current directory
- `config *` — reads and mutates local config files
- `install` — resolves config from local file or remote URL, then executes install commands

When changing CLI behavior, start in `src/cli.ts` and trace outward.

### Config layer

`src/config.ts` is the core domain module. It owns:
- the shared config schema (`skills`, `claudeCodePlugins`)
- default config file naming
- local config file read/write and path resolution
- remote config URL validation and HTTP loading
- mutation helpers for adding and removing skills/plugins
- install-source precedence resolution

The important architectural choice is that **local config files and remote JSON configs use the same schema**. Any schema change should be made here first and then reflected in tests and README examples.

`install` resolves config sources in this order:
1. `--config-file-path`
2. `./plasticine-agent-dotfile.config.json`
3. `PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL`
4. `--config-json-url`

If none exist, `install` fails with guidance to run `init`.

### Prompt layer

`src/prompts.ts` contains all interactive UI behavior via `@clack/prompts`.

This module is intentionally separate from `src/config.ts` so validation and file mutation logic stay usable in tests without interactive dependencies. If a workflow needs new prompts, add them here and keep `src/config.ts` non-interactive.

Current prompts cover:
- install scope selection
- skill target agent selection
- missing fields for `config add-*` / `config remove-*`
- fallback config file path input for local config mutations
- spinner creation for remote config loading

### Install execution layer

`src/install.ts` turns a resolved config plus install selections into concrete shell commands and executes them.

Important behavior:
- command generation is pure (`buildCommands`)
- execution is sequential
- failures are collected and reported at the end instead of aborting on the first failed command

`src/run-command.ts` is the process boundary. It wraps `spawn()` and streams child stdout/stderr through the parent process.

### Option resolution

`src/options.ts` handles install-target flag resolution independently from config loading. It determines whether prompts are needed for install scope or agent selection. Keep this separation: install target selection and config source resolution are different concerns.

## Tests

The tests are organized by responsibility rather than by command:
- `tests/config.test.ts` — schema validation, config file IO, config source precedence, and mutation helpers
- `tests/install.test.ts` — command generation and install execution behavior
- `tests/options.test.ts` — install flag resolution behavior
- `tests/package.test.ts` — package metadata and published bin names

When behavior spans multiple modules, update the focused test file for each module rather than creating a single broad integration test by default.

## Docs expectations

`README.md` is written from the perspective of an npm package user, not a repository developer. When changing user-facing command behavior, keep the README aligned with:
- `npx plasticine-agent-dotfile ...` examples
- local config file workflow
- install source precedence
- interactive fallback behavior

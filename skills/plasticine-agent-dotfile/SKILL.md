---
name: plasticine-agent-dotfile
description: Use when initializing, viewing, editing, or installing from the plasticine-agent-dotfile CLI or its pad alias and local or remote JSON config.
---

# plasticine-agent-dotfile

## Overview
This skill helps with the end-user workflow for the `plasticine-agent-dotfile` CLI. Default to the local config file workflow first; remote config URLs are a fallback for `install` when no suitable local config file is available.

## When to Use
Use this when you need to:
- create `plasticine-agent-dotfile.config.json`
- inspect or modify `skills` and `claudeCodePlugins`
- run `install` from a local config file or remote config URL
- decide whether to use `plasticine-agent-dotfile` or the `pad` command alias

Do not use this for changing the CLI implementation itself.

## Quick Reference

| Goal | Command |
|---|---|
| Create default config file | `npx plasticine-agent-dotfile init` |
| Show full config | `npx plasticine-agent-dotfile config list` |
| Show only skills | `npx plasticine-agent-dotfile config list --skills` |
| Show only Claude Code plugins | `npx plasticine-agent-dotfile config list --claude-code` |
| Add skill | `npx plasticine-agent-dotfile config add-skill --source-name <source> --skill-name <name>` |
| Remove skill | `npx plasticine-agent-dotfile config remove-skill --skill-name <name>` |
| Add Claude Code plugin | `npx plasticine-agent-dotfile config add-claude-code-plugin --package-name <package>` |
| Remove Claude Code plugin | `npx plasticine-agent-dotfile config remove-claude-code-plugin --package-name <package>` |
| Install from local config | `npx plasticine-agent-dotfile install` |
| Install from remote config | `npx plasticine-agent-dotfile install --config-json-url <url>` |

If the package is globally installed and the alias is available, `pad` can replace `plasticine-agent-dotfile` in the same commands.

## Install Config Resolution
`install` resolves config in this order:
1. `--config-file-path`
2. `./plasticine-agent-dotfile.config.json`
3. `PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL`
4. `--config-json-url`

If no source exists, the right next step is `npx plasticine-agent-dotfile init`.

## Common Mistakes
- Reaching for remote config first when a local `plasticine-agent-dotfile.config.json` should be the default workflow
- Forgetting that `config add-*` and `config remove-*` can prompt for missing fields
- Assuming `config` commands silently create missing files; only `init` creates the default file
- Passing an invalid `--config-file-path` and expecting fallback behavior; explicit invalid paths fail immediately
- Forgetting that `config list` defaults to the whole config unless `--skills` or `--claude-code` is provided

## Notes
- The config schema uses `skills` and `claudeCodePlugins`.
- Local config files and remote config JSON use the same schema.
- `pad` is a command alias, not a different workflow.

# plasticine-agent-dotfile

A small Node.js CLI for creating, editing, and installing skills and Claude Code plugins from a local or remote JSON config.

## Setup

Install dependencies and build the CLI:

```bash
pnpm install
pnpm build
```

Then run it through your package manager, or install/link the package so the bin commands are available:

```bash
pnpm exec plasticine-agent-dotfile install
pnpm exec pad install
```

## Local config file

The default local config file name is:

```text
plasticine-agent-dotfile.config.json
```

Create it in the current directory with:

```bash
plasticine-agent-dotfile init
```

The generated file uses this schema:

```json
{
  "skills": [
    {
      "sourceName": "github.com/example/cli",
      "skillName": "example-skill"
    }
  ],
  "claudeCodePlugins": [
    {
      "packageName": "superpowers@claude-plugins-official"
    }
  ]
}
```

## Install config source precedence

`install` resolves configuration in this order:

1. `--config-file-path`
2. `./plasticine-agent-dotfile.config.json`
3. `PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL`
4. `--config-json-url`

If none of these sources exist, the CLI fails and asks you to run `plasticine-agent-dotfile init` first.

Only `http` and `https` URLs are supported for remote configs.

## Install modes

With no install flags, the CLI will ask:

1. What to install: `skills`, `claude code plugins`, or both
2. Which agents should receive skills: `claude-code`, `trae`, `trae-cn`

The agent prompt defaults to all three selected.

When loading a remote config, the CLI shows a spinner while downloading and validating the JSON.

## Config commands

List the whole config:

```bash
plasticine-agent-dotfile config list
```

List only skills:

```bash
plasticine-agent-dotfile config list --skills
```

List only Claude Code plugins:

```bash
plasticine-agent-dotfile config list --claude-code
```

Add a skill:

```bash
plasticine-agent-dotfile config add-skill --source-name github.com/larksuite/cli --skill-name lark-doc
```

Remove a skill:

```bash
plasticine-agent-dotfile config remove-skill --skill-name lark-doc
```

Add a Claude Code plugin:

```bash
plasticine-agent-dotfile config add-claude-code-plugin --package-name superpowers@claude-plugins-official
```

Remove a Claude Code plugin:

```bash
plasticine-agent-dotfile config remove-claude-code-plugin --package-name superpowers@claude-plugins-official
```

All `config` subcommands support `--config-file-path`. If omitted, they default to the current directory config file. If the default file does not exist, `add` and `remove` will ask for a config file path. If you pass an invalid `--config-file-path`, the command fails immediately.

## Non-interactive usage

Install only skills from the current directory config file:

```bash
plasticine-agent-dotfile install --skills
```

Install only Claude Code plugins from a specific config file:

```bash
plasticine-agent-dotfile install --config-file-path /path/to/plasticine-agent-dotfile.config.json --claude-code-plugins
```

Install from a remote URL when no local config file is available:

```bash
plasticine-agent-dotfile install --config-json-url https://example.com/config.json --skills --claude-code-plugins
```

Install from an environment-provided remote config URL:

```bash
PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL=https://example.com/config.json \
plasticine-agent-dotfile install --skills
```

The `pad` alias supports the same commands and flags.

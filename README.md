# plasticine-agent-dotfile

`plasticine-agent-dotfile` is a CLI for managing a JSON config file and installing skills and Claude Code plugins from that config.

## Quick start

If you are using Claude Code, prefer the repository skill first:

- skill name: `plasticine-agent-dotfile`
- skill file: `skills/plasticine-agent-dotfile/SKILL.md`

Use that skill when you want Claude to initialize, inspect, edit, or install from a `plasticine-agent-dotfile` config on your behalf.

If you want to run the CLI directly yourself:

Create a config file in the current directory:

```bash
npx plasticine-agent-dotfile init
```

List the current config:

```bash
npx plasticine-agent-dotfile config list
```

Install everything from the local config file:

```bash
npx plasticine-agent-dotfile install
```

If you installed the package globally and exposed the bin alias, you can also use `pad`.

## Local config file

The default file name is:

```text
plasticine-agent-dotfile.config.json
```

`init` creates this file in the current directory.

Example config:

```json
{
  "skills": [
    {
      "sourceName": "github.com/example/cli",
      "skillName": "example-skill"
    },
    {
      "sourceName": "github.com/larksuite/cli",
      "skillName": "lark-doc"
    }
  ],
  "claudeCodePlugins": [
    {
      "packageName": "superpowers@claude-plugins-official"
    }
  ]
}
```

## Commands

### `init`

Create `plasticine-agent-dotfile.config.json` in the current directory:

```bash
npx plasticine-agent-dotfile init
```

### `config list`

Show the whole config:

```bash
npx plasticine-agent-dotfile config list
```

Show only skills:

```bash
npx plasticine-agent-dotfile config list --skills
```

Show only Claude Code plugins:

```bash
npx plasticine-agent-dotfile config list --claude-code
```

### `config add-skill`

Add a skill entry:

```bash
npx plasticine-agent-dotfile config add-skill --source-name github.com/larksuite/cli --skill-name lark-doc
```

If you omit required fields, the CLI asks for them interactively.

### `config remove-skill`

Remove a skill entry:

```bash
npx plasticine-agent-dotfile config remove-skill --skill-name lark-doc
```

### `config add-claude-code-plugin`

Add a Claude Code plugin entry:

```bash
npx plasticine-agent-dotfile config add-claude-code-plugin --package-name superpowers@claude-plugins-official
```

### `config remove-claude-code-plugin`

Remove a Claude Code plugin entry:

```bash
npx plasticine-agent-dotfile config remove-claude-code-plugin --package-name superpowers@claude-plugins-official
```

### `--config-file-path`

All `config` subcommands support `--config-file-path`:

```bash
npx plasticine-agent-dotfile config list --config-file-path /path/to/plasticine-agent-dotfile.config.json
```

If `--config-file-path` is invalid, the command fails immediately.

If you do not pass `--config-file-path`, the CLI uses the current directory config file. For `config add-*` and `config remove-*`, if the default file does not exist, the CLI asks for a config file path.

## Install

### Default behavior

`install` resolves config in this order:

1. `--config-file-path`
2. `./plasticine-agent-dotfile.config.json`
3. `PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL`
4. `--config-json-url`

If none of these sources exist, the CLI tells you to run `npx plasticine-agent-dotfile init` first.

### Install everything from the local config file

```bash
npx plasticine-agent-dotfile install
```

### Install only skills

```bash
npx plasticine-agent-dotfile install --skills
```

### Install only Claude Code plugins

```bash
npx plasticine-agent-dotfile install --claude-code-plugins
```

### Install from a specific local config file

```bash
npx plasticine-agent-dotfile install --config-file-path /path/to/plasticine-agent-dotfile.config.json --skills
```

### Install from a remote config URL

```bash
npx plasticine-agent-dotfile install --config-json-url https://example.com/config.json --skills --claude-code-plugins
```

### Install from an environment-provided remote config URL

```bash
PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL=https://example.com/config.json \
npx plasticine-agent-dotfile install --skills
```

Only `http` and `https` URLs are supported for remote configs.

## Interactive behavior

When needed, the CLI prompts for:

- which install targets to run (`skills`, `claude code plugins`, or both)
- which agents should receive skills (`claude-code`, `trae`, `trae-cn`)
- missing `config add-*` / `config remove-*` fields
- a config file path for `config add-*` / `config remove-*` when the default file is missing

When loading a remote config, the CLI shows a spinner while downloading and validating the JSON.

import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addClaudeCodePlugin,
  addSkill,
  assertInstallSelectionSupported,
  createInitialConfig,
  DEFAULT_CONFIG_FILE_NAME,
  loadRemoteConfig,
  readConfigFile,
  removeClaudeCodePlugin,
  removeSkill,
  resolveConfigFilePath,
  resolveInstallConfigSource,
  resolveRemoteConfigUrl,
  validateRemoteConfig,
  writeConfigFile,
} from "../src/config.js";

const VALID_CONFIG = {
  skills: [{ sourceName: "github.com/example/cli", skillName: "example-skill" }],
  claudeCodePlugins: [{ packageName: "example@official" }],
};

afterEach(() => {
  delete process.env.PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL;
});

describe("resolveRemoteConfigUrl", () => {
  it("prefers environment variable over flag", async () => {
    process.env.PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL = "https://env.example.com/config.json";

    await expect(resolveRemoteConfigUrl("https://flag.example.com/config.json")).resolves.toEqual({
      url: "https://env.example.com/config.json",
      source: "env",
    });
  });

  it("uses flag when environment variable is absent", async () => {
    await expect(resolveRemoteConfigUrl("https://flag.example.com/config.json")).resolves.toEqual({
      url: "https://flag.example.com/config.json",
      source: "flag",
    });
  });
});

describe("loadRemoteConfig", () => {
  it("loads and validates remote config JSON", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(VALID_CONFIG), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(loadRemoteConfig("https://example.com/config.json", fetchImpl)).resolves.toEqual(VALID_CONFIG);
  });

  it("fails on non-2xx responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("not found", { status: 404 }));

    await expect(loadRemoteConfig("https://example.com/config.json", fetchImpl)).rejects.toThrow(
      "Failed to download config JSON from https://example.com/config.json: HTTP 404",
    );
  });

  it("fails on invalid JSON shape", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ skills: "bad", claudeCodePlugins: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(loadRemoteConfig("https://example.com/config.json", fetchImpl)).rejects.toThrow(
      "Invalid config shape: skills must be an array",
    );
  });
});

describe("local config files", () => {
  it("creates the expected initial config", () => {
    expect(createInitialConfig()).toEqual({
      skills: [],
      claudeCodePlugins: [],
    });
  });

  it("reads and writes config files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pad-config-"));
    const filePath = join(directory, DEFAULT_CONFIG_FILE_NAME);

    await writeConfigFile(filePath, VALID_CONFIG);
    await expect(readConfigFile(filePath)).resolves.toEqual(VALID_CONFIG);

    await rm(directory, { recursive: true, force: true });
  });

  it("resolves explicit config file paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pad-config-"));
    const filePath = join(directory, DEFAULT_CONFIG_FILE_NAME);
    await writeFile(filePath, JSON.stringify(VALID_CONFIG));

    await expect(resolveConfigFilePath(filePath)).resolves.toBe(resolve(filePath));

    await rm(directory, { recursive: true, force: true });
  });

  it("rejects invalid explicit config file paths", async () => {
    await expect(resolveConfigFilePath("/definitely/missing/config.json")).rejects.toThrow("Invalid config file path");
  });

  it("prefers explicit file path during install source resolution", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pad-config-"));
    const filePath = join(directory, DEFAULT_CONFIG_FILE_NAME);
    await writeFile(filePath, JSON.stringify(VALID_CONFIG));
    process.env.PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL = "https://env.example.com/config.json";

    await expect(resolveInstallConfigSource(directory, filePath, undefined)).resolves.toEqual({
      kind: "file",
      path: resolve(filePath),
    });

    await rm(directory, { recursive: true, force: true });
  });

  it("uses default config file from cwd before remote URL", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pad-config-"));
    const filePath = join(directory, DEFAULT_CONFIG_FILE_NAME);
    await writeFile(filePath, JSON.stringify(VALID_CONFIG));
    process.env.PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL = "https://env.example.com/config.json";

    await expect(resolveInstallConfigSource(directory, undefined, undefined)).resolves.toEqual({
      kind: "file",
      path: resolve(filePath),
    });

    await rm(directory, { recursive: true, force: true });
  });

  it("falls back to remote URL when local config file does not exist", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pad-config-"));
    process.env.PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL = "https://env.example.com/config.json";

    await expect(resolveInstallConfigSource(directory, undefined, undefined)).resolves.toEqual({
      kind: "remote",
      resolution: {
        url: "https://env.example.com/config.json",
        source: "env",
      },
    });

    await rm(directory, { recursive: true, force: true });
  });

  it("fails with init guidance when no local or remote config is available", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pad-config-"));

    await expect(resolveInstallConfigSource(directory, undefined, undefined)).rejects.toThrow(
      `No config found. Run \`plasticine-agent-dotfile init\` to create ${DEFAULT_CONFIG_FILE_NAME} and try again.`,
    );

    await rm(directory, { recursive: true, force: true });
  });

  it("adds and removes skills and plugins", () => {
    const withSkill = addSkill(createInitialConfig(), {
      sourceName: "github.com/larksuite/cli",
      skillName: "lark-doc",
    });
    const withPlugin = addClaudeCodePlugin(withSkill, { packageName: "superpowers@claude-plugins-official" });

    expect(withPlugin).toEqual({
      skills: [{ sourceName: "github.com/larksuite/cli", skillName: "lark-doc" }],
      claudeCodePlugins: [{ packageName: "superpowers@claude-plugins-official" }],
    });

    expect(removeSkill(withPlugin, "lark-doc").skills).toEqual([]);
    expect(removeClaudeCodePlugin(withPlugin, "superpowers@claude-plugins-official").claudeCodePlugins).toEqual([]);
  });

  it("rejects removing missing entries", () => {
    expect(() => removeSkill(createInitialConfig(), "missing-skill")).toThrow("Skill not found: missing-skill");
    expect(() => removeClaudeCodePlugin(createInitialConfig(), "missing-plugin")).toThrow(
      "Claude Code plugin not found: missing-plugin",
    );
  });

  it("stores init output at the default file name", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pad-config-"));
    const filePath = join(directory, DEFAULT_CONFIG_FILE_NAME);

    await writeConfigFile(filePath, createInitialConfig());
    await expect(stat(filePath)).resolves.toBeDefined();

    await rm(directory, { recursive: true, force: true });
  });
});

describe("validateRemoteConfig", () => {
  it("requires camelCase top-level fields", () => {
    expect(() => validateRemoteConfig({ skills: [], "claude-code-plugins": [] })).toThrow(
      "Invalid config shape: claudeCodePlugins must be an array",
    );
  });
});

describe("assertInstallSelectionSupported", () => {
  it("allows empty skills when only plugins are installed", () => {
    expect(() =>
      assertInstallSelectionSupported(
        {
          skills: [],
          claudeCodePlugins: [{ packageName: "example@official" }],
        },
        false,
        true,
      ),
    ).not.toThrow();
  });

  it("rejects selecting skills when config has no skills", () => {
    expect(() =>
      assertInstallSelectionSupported(
        {
          skills: [],
          claudeCodePlugins: [{ packageName: "example@official" }],
        },
        true,
        false,
      ),
    ).toThrow("Config does not define any skills to install");
  });
});

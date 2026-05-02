import { constants as fsConstants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type SkillCommandConfig = {
  sourceName: string;
  skillName: string;
};

export type ClaudeCodePluginConfig = {
  packageName: string;
};

export type RemoteConfig = {
  skills: SkillCommandConfig[];
  claudeCodePlugins: ClaudeCodePluginConfig[];
};

export const DEFAULT_CONFIG_FILE_NAME = "plasticine-agent-dotfile.config.json";
const ENV_CONFIG_JSON_URL_KEY = "PLASTICINE_AGENT_DOTFILE_CONFIG_JSON_URL";

export type ConfigUrlResolution = {
  url: string;
  source: "env" | "flag";
};

export type InstallConfigSource =
  | {
      kind: "file";
      path: string;
    }
  | {
      kind: "remote";
      resolution: ConfigUrlResolution;
    };

export async function resolveInstallConfigSource(
  cwd: string,
  configFilePath?: string,
  configJsonUrl?: string,
): Promise<InstallConfigSource> {
  if (configFilePath) {
    return {
      kind: "file",
      path: await resolveConfigFilePath(configFilePath),
    };
  }

  const defaultFilePath = resolve(cwd, DEFAULT_CONFIG_FILE_NAME);
  if (await fileExists(defaultFilePath)) {
    return {
      kind: "file",
      path: defaultFilePath,
    };
  }

  const remoteResolution = await resolveRemoteConfigUrl(configJsonUrl);
  if (remoteResolution) {
    return {
      kind: "remote",
      resolution: remoteResolution,
    };
  }

  throw new Error(
    `No config found. Run \`plasticine-agent-dotfile init\` to create ${DEFAULT_CONFIG_FILE_NAME} and try again.`,
  );
}

export async function resolveConfigFilePath(filePath: string): Promise<string> {
  const resolvedPath = resolve(filePath);
  if (!(await fileExists(resolvedPath))) {
    throw new Error(`Invalid config file path: ${filePath}`);
  }
  return resolvedPath;
}

export async function readConfigFile(filePath: string): Promise<RemoteConfig> {
  const raw = await readFile(filePath, "utf8");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in config file ${filePath}: ${formatError(error)}`);
  }

  return validateRemoteConfig(payload);
}

export async function writeConfigFile(filePath: string, config: RemoteConfig): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function createInitialConfig(): RemoteConfig {
  return {
    skills: [],
    claudeCodePlugins: [],
  };
}

export function addSkill(config: RemoteConfig, skill: SkillCommandConfig): RemoteConfig {
  if (config.skills.some((entry) => entry.skillName === skill.skillName)) {
    throw new Error(`Skill already exists: ${skill.skillName}`);
  }

  return {
    ...config,
    skills: [...config.skills, skill],
  };
}

export function removeSkill(config: RemoteConfig, skillName: string): RemoteConfig {
  if (!config.skills.some((entry) => entry.skillName === skillName)) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  return {
    ...config,
    skills: config.skills.filter((entry) => entry.skillName !== skillName),
  };
}

export function addClaudeCodePlugin(config: RemoteConfig, plugin: ClaudeCodePluginConfig): RemoteConfig {
  if (config.claudeCodePlugins.some((entry) => entry.packageName === plugin.packageName)) {
    throw new Error(`Claude Code plugin already exists: ${plugin.packageName}`);
  }

  return {
    ...config,
    claudeCodePlugins: [...config.claudeCodePlugins, plugin],
  };
}

export function removeClaudeCodePlugin(config: RemoteConfig, packageName: string): RemoteConfig {
  if (!config.claudeCodePlugins.some((entry) => entry.packageName === packageName)) {
    throw new Error(`Claude Code plugin not found: ${packageName}`);
  }

  return {
    ...config,
    claudeCodePlugins: config.claudeCodePlugins.filter((entry) => entry.packageName !== packageName),
  };
}

export async function resolveRemoteConfigUrl(flagValue?: string): Promise<ConfigUrlResolution | undefined> {
  const envValue = process.env[ENV_CONFIG_JSON_URL_KEY];
  if (envValue) {
    return {
      url: validateConfigJsonUrl(envValue),
      source: "env",
    };
  }

  if (flagValue) {
    return {
      url: validateConfigJsonUrl(flagValue),
      source: "flag",
    };
  }

  return undefined;
}

export async function loadRemoteConfig(url: string, fetchImpl: typeof fetch = fetch): Promise<RemoteConfig> {
  validateConfigJsonUrl(url);

  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new Error(`Failed to download config JSON from ${url}: ${formatError(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to download config JSON from ${url}: HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${formatError(error)}`);
  }

  return validateRemoteConfig(payload);
}

export function validateRemoteConfig(value: unknown): RemoteConfig {
  if (!isRecord(value)) {
    throw new Error("Invalid config shape: expected a JSON object");
  }

  const skills = value.skills;
  const claudeCodePlugins = value.claudeCodePlugins;

  if (!Array.isArray(skills)) {
    throw new Error("Invalid config shape: skills must be an array");
  }

  if (!Array.isArray(claudeCodePlugins)) {
    throw new Error("Invalid config shape: claudeCodePlugins must be an array");
  }

  return {
    skills: skills.map((entry, index) => validateSkillCommandConfig(entry, index)),
    claudeCodePlugins: claudeCodePlugins.map((entry, index) => validateClaudeCodePluginConfig(entry, index)),
  };
}

export function assertInstallSelectionSupported(
  config: RemoteConfig,
  installSkills: boolean,
  installClaudeCodePlugins: boolean,
): void {
  if (installSkills && config.skills.length === 0) {
    throw new Error("Config does not define any skills to install");
  }

  if (installClaudeCodePlugins && config.claudeCodePlugins.length === 0) {
    throw new Error("Config does not define any Claude Code plugins to install");
  }
}

function validateSkillCommandConfig(value: unknown, index: number): SkillCommandConfig {
  if (!isRecord(value)) {
    throw new Error(`Invalid config shape: skills[${index}] must be an object`);
  }

  if (typeof value.sourceName !== "string" || value.sourceName.length === 0) {
    throw new Error(`Invalid config shape: skills[${index}].sourceName must be a non-empty string`);
  }

  if (typeof value.skillName !== "string" || value.skillName.length === 0) {
    throw new Error(`Invalid config shape: skills[${index}].skillName must be a non-empty string`);
  }

  return {
    sourceName: value.sourceName,
    skillName: value.skillName,
  };
}

function validateClaudeCodePluginConfig(value: unknown, index: number): ClaudeCodePluginConfig {
  if (!isRecord(value)) {
    throw new Error(`Invalid config shape: claudeCodePlugins[${index}] must be an object`);
  }

  if (typeof value.packageName !== "string" || value.packageName.length === 0) {
    throw new Error(`Invalid config shape: claudeCodePlugins[${index}].packageName must be a non-empty string`);
  }

  return {
    packageName: value.packageName,
  };
}

function validateConfigJsonUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Config JSON URL must be a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Config JSON URL must use http or https");
  }

  return url.toString();
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

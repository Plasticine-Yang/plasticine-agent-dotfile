import { cwd } from 'node:process';
import { Command, InvalidArgumentError } from 'commander';
import {
  addClaudeCodePlugin,
  addSkill,
  assertInstallSelectionSupported,
  createInitialConfig,
  readConfigFile,
  removeClaudeCodePlugin,
  removeSkill,
  resolveConfigFilePath,
  resolveInstallConfigSource,
  loadRemoteConfig,
  writeConfigFile,
  type RemoteConfig,
  type ConfigUrlResolution,
} from './config.js';
import { installAll } from './install.js';
import { ALL_AGENTS, resolveInstallRequest, type AgentName } from './options.js';
import {
  createConfigLoaderSpinner,
  ensureConfigFileDirectory,
  promptForConfigFilePath,
  promptForConfigMutationFields,
  promptForMissingSelections,
} from './prompts.js';

const program = new Command();

program.name('plasticine-agent-dotfile');

program
  .command('init')
  .description('Create a default local config file')
  .action(async () => {
    const filePath = `${cwd()}/plasticine-agent-dotfile.config.json`;
    await ensureConfigFileDirectory(filePath);
    await writeConfigFile(filePath, createInitialConfig());
    process.stdout.write(`Created config file at ${filePath}\n`);
  });

program
  .command('install')
  .description('Install skills and Claude Code plugins')
  .option('--skills', 'Install skills')
  .option('--claude-code-plugins', 'Install Claude Code plugins')
  .option('--config-json-url <url>', 'Remote config JSON URL')
  .option('--config-file-path <path>', 'Local config file path')
  .option('--agent <agent>', 'Target agent for skills', collectAgent, [])
  .action(
    async (options: {
      skills?: boolean;
      claudeCodePlugins?: boolean;
      configJsonUrl?: string;
      configFilePath?: string;
      agent: AgentName[];
    }) => {
      const request = resolveInstallRequest({
        skills: options.skills,
        claudeCodePlugins: options.claudeCodePlugins,
        agents: options.agent,
      });

      const config = await loadInstallConfig(process.cwd(), options.configFilePath, options.configJsonUrl);
      assertInstallSelectionSupported(config, request.installSkills, request.installClaudeCodePlugins);

      const resolved = await promptForMissingSelections(request);
      assertInstallSelectionSupported(config, resolved.installSkills, resolved.installClaudeCodePlugins);
      await installAll(resolved, config);
    },
  );

const configCommand = program.command('config').description('Manage local config files');

configCommand
  .command('list')
  .description('List config entries')
  .option('--config-file-path <path>', 'Local config file path')
  .option('--skills', 'Show only skills')
  .option('--claude-code', 'Show only Claude Code plugins')
  .action(async (options: { configFilePath?: string; skills?: boolean; claudeCode?: boolean }) => {
    const filePath = await resolveConfigPathForMutation(process.cwd(), options.configFilePath);
    const config = await readConfigFile(filePath);

    if (options.skills && !options.claudeCode) {
      process.stdout.write(`${JSON.stringify({ skills: config.skills }, null, 2)}\n`);
      return;
    }

    if (options.claudeCode && !options.skills) {
      process.stdout.write(`${JSON.stringify({ claudeCodePlugins: config.claudeCodePlugins }, null, 2)}\n`);
      return;
    }

    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
  });

configCommand
  .command('add-skill')
  .description('Add a skill entry to the config file')
  .option('--config-file-path <path>', 'Local config file path')
  .option('--source-name <sourceName>', 'Skill source name')
  .option('--skill-name <skillName>', 'Skill name')
  .action(async (options: { configFilePath?: string; sourceName?: string; skillName?: string }) => {
    const filePath = await resolveConfigPathForMutation(process.cwd(), options.configFilePath);
    const values = await promptForConfigMutationFields('add-skill', options);
    const config = await readConfigFile(filePath);
    const nextConfig = addSkill(config, {
      sourceName: values.sourceName!,
      skillName: values.skillName!,
    });
    await writeConfigFile(filePath, nextConfig);
    process.stdout.write(`Added skill ${values.skillName} to ${filePath}\n`);
  });

configCommand
  .command('remove-skill')
  .description('Remove a skill entry from the config file')
  .option('--config-file-path <path>', 'Local config file path')
  .option('--skill-name <skillName>', 'Skill name')
  .action(async (options: { configFilePath?: string; skillName?: string }) => {
    const filePath = await resolveConfigPathForMutation(process.cwd(), options.configFilePath);
    const values = await promptForConfigMutationFields('remove-skill', options);
    const config = await readConfigFile(filePath);
    const nextConfig = removeSkill(config, values.skillName!);
    await writeConfigFile(filePath, nextConfig);
    process.stdout.write(`Removed skill ${values.skillName} from ${filePath}\n`);
  });

configCommand
  .command('add-claude-code-plugin')
  .description('Add a Claude Code plugin entry to the config file')
  .option('--config-file-path <path>', 'Local config file path')
  .option('--package-name <packageName>', 'Claude Code plugin package name')
  .action(async (options: { configFilePath?: string; packageName?: string }) => {
    const filePath = await resolveConfigPathForMutation(process.cwd(), options.configFilePath);
    const values = await promptForConfigMutationFields('add-claude-code-plugin', options);
    const config = await readConfigFile(filePath);
    const nextConfig = addClaudeCodePlugin(config, {
      packageName: values.packageName!,
    });
    await writeConfigFile(filePath, nextConfig);
    process.stdout.write(`Added Claude Code plugin ${values.packageName} to ${filePath}\n`);
  });

configCommand
  .command('remove-claude-code-plugin')
  .description('Remove a Claude Code plugin entry from the config file')
  .option('--config-file-path <path>', 'Local config file path')
  .option('--package-name <packageName>', 'Claude Code plugin package name')
  .action(async (options: { configFilePath?: string; packageName?: string }) => {
    const filePath = await resolveConfigPathForMutation(process.cwd(), options.configFilePath);
    const values = await promptForConfigMutationFields('remove-claude-code-plugin', options);
    const config = await readConfigFile(filePath);
    const nextConfig = removeClaudeCodePlugin(config, values.packageName!);
    await writeConfigFile(filePath, nextConfig);
    process.stdout.write(`Removed Claude Code plugin ${values.packageName} from ${filePath}\n`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

function collectAgent(value: string, previous: AgentName[]): AgentName[] {
  if (!ALL_AGENTS.includes(value as AgentName)) {
    throw new InvalidArgumentError(`Invalid agent: ${value}`);
  }

  return [...previous, value as AgentName];
}

async function loadInstallConfig(currentWorkingDirectory: string, configFilePath?: string, configJsonUrl?: string): Promise<RemoteConfig> {
  const source = await resolveInstallConfigSource(currentWorkingDirectory, configFilePath, configJsonUrl);

  if (source.kind === 'file') {
    process.stdout.write(`Using config file ${source.path}.\n`);
    return readConfigFile(source.path);
  }

  announceConfigUrlSource(source.resolution);
  const loadSpinner = createConfigLoaderSpinner();
  loadSpinner.start(`Loading config JSON from ${source.resolution.source}...`);
  const config = await loadRemoteConfig(source.resolution.url);
  loadSpinner.message('Validating config JSON...');
  loadSpinner.stop('Loaded config JSON');
  return config;
}

async function resolveConfigPathForMutation(currentWorkingDirectory: string, explicitFilePath?: string): Promise<string> {
  if (explicitFilePath) {
    return resolveConfigFilePath(explicitFilePath);
  }

  const defaultPath = `${currentWorkingDirectory}/plasticine-agent-dotfile.config.json`;
  try {
    return await resolveConfigFilePath(defaultPath);
  } catch {
    return promptForConfigFilePath();
  }
}

function announceConfigUrlSource(configUrlResolution: ConfigUrlResolution) {
  if (configUrlResolution.source === 'env') {
    process.stdout.write('Using config JSON URL from environment variable.\n');
    return;
  }

  process.stdout.write('Using config JSON URL from --config-json-url.\n');
}

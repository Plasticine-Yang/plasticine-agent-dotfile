import type { RemoteConfig } from './config.js';
import type { AgentName } from './options.js';
import { createCommandRunner, type CommandRunner } from './run-command.js';

export type InstallPlan = {
  installSkills: boolean;
  installClaudeCodePlugins: boolean;
  agents: AgentName[];
};

export type FailedCommand = {
  command: string;
  error: Error;
};

export async function installAll(
  plan: InstallPlan,
  config: RemoteConfig,
  runner: CommandRunner = createCommandRunner(),
): Promise<void> {
  const commands = buildCommands(plan, config);
  const failures: FailedCommand[] = [];

  commands.forEach(({ label }, index) => {
    process.stdout.write(`[${index + 1}/${commands.length}] ${label}\n`);
  });

  for (const command of commands) {
    try {
      await runner(command.command, command.args);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      process.stderr.write(`Step failed: ${command.label}\n`);
      failures.push({
        command: [command.command, ...command.args].join(' '),
        error: normalized,
      });
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`Installation finished with ${failures.length} failure(s).\n`);
    process.stderr.write('Failed commands:\n');
    for (const failure of failures) {
      process.stderr.write(` - ${failure.command}\n`);
    }
    throw new Error('Installation failed');
  }

  process.stdout.write('Installation complete.\n');
}

export function buildCommands(plan: InstallPlan, config: RemoteConfig) {
  const commands: Array<{ label: string; command: string; args: string[] }> = [];

  if (plan.installSkills) {
    for (const entry of config.skills) {
      commands.push({
        label: `skills add ${entry.skillName}`,
        command: 'skills',
        args: [
          'add',
          entry.sourceName,
          '--skill',
          entry.skillName,
          '-g',
          '-y',
          ...plan.agents.flatMap((agent) => ['-a', agent]),
        ],
      });
    }
  }

  if (plan.installClaudeCodePlugins) {
    for (const entry of config.claudeCodePlugins) {
      commands.push({
        label: `claude plugin install ${entry.packageName}`,
        command: 'claude',
        args: ['plugin', 'install', entry.packageName],
      });
    }
  }

  return commands;
}

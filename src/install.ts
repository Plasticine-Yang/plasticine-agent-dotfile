import type { RemoteConfig } from "./config.js";
import type { AgentName } from "./options.js";
import { type CommandRunner, createCommandRunner } from "./run-command.js";

export type InstallPlan = {
  installSkills: boolean;
  installClaudeCodePlugins: boolean;
  agents: AgentName[];
};

export type FailedCommand = {
  command: string;
  error: Error;
};

export type InstallCommand =
  | {
      target: "skill";
      label: string;
      command: "skills";
      args: string[];
      skillName: string;
    }
  | {
      target: "plugin";
      label: string;
      command: "claude";
      args: string[];
      packageName: string;
    };

export async function installAll(
  plan: InstallPlan,
  config: RemoteConfig,
  runner: CommandRunner = createCommandRunner(),
): Promise<void> {
  const commands = buildCommands(plan, config);
  const failures: FailedCommand[] = [];
  const skillCommands = commands.filter((command) => command.target === "skill");
  const pluginCommands = commands.filter((command) => command.target === "plugin");

  await installSkills(skillCommands, runner, failures);
  await installPlugins(pluginCommands, runner, failures);

  if (failures.length > 0) {
    process.stderr.write(`Installation finished with ${failures.length} failure(s).\n`);
    process.stderr.write("Failed commands:\n");
    for (const failure of failures) {
      process.stderr.write(` - ${failure.command}\n`);
    }
    throw new Error("Installation failed");
  }

  process.stdout.write("Installation complete.\n");
}

export function buildCommands(plan: InstallPlan, config: RemoteConfig): InstallCommand[] {
  const commands: InstallCommand[] = [];

  if (plan.installSkills) {
    for (const entry of config.skills) {
      commands.push({
        target: "skill",
        label: `skills add ${entry.skillName}`,
        command: "skills",
        args: [
          "add",
          entry.sourceName,
          "--skill",
          entry.skillName,
          "-g",
          "-y",
          ...plan.agents.flatMap((agent) => ["-a", agent]),
        ],
        skillName: entry.skillName,
      });
    }
  }

  if (plan.installClaudeCodePlugins) {
    for (const entry of config.claudeCodePlugins) {
      commands.push({
        target: "plugin",
        label: `claude plugin install ${entry.packageName}`,
        command: "claude",
        args: ["plugin", "install", entry.packageName],
        packageName: entry.packageName,
      });
    }
  }

  return commands;
}

async function installSkills(
  commands: Extract<InstallCommand, { target: "skill" }>[],
  runner: CommandRunner,
  failures: FailedCommand[],
) {
  if (commands.length === 0) {
    return;
  }

  const total = commands.length;
  let settled = 0;

  writeSkillProgress(settled, total, "installing…");

  await Promise.all(
    commands.map(async (command) => {
      try {
        await runner(command.command, command.args, { output: "silent" });
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        failures.push({
          command: [command.command, ...command.args].join(" "),
          error: normalized,
        });
      } finally {
        settled += 1;
        writeSkillProgress(settled, total, "installing…");
      }
    }),
  );

  writeSkillProgress(settled, total, failures.length > 0 ? "completed with failures" : "completed");
  process.stdout.write("\n");
}

function writeSkillProgress(current: number, total: number, status: string) {
  const currentText = String(current).padStart(2, "0");
  const totalText = String(total).padStart(2, "0");
  process.stdout.write(`\r\x1b[2K${currentText}/${totalText} ${status}`);
}

async function installPlugins(
  commands: Extract<InstallCommand, { target: "plugin" }>[],
  runner: CommandRunner,
  failures: FailedCommand[],
) {
  for (const command of commands) {
    try {
      await runner(command.command, command.args, { output: "stream" });
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      failures.push({
        command: [command.command, ...command.args].join(" "),
        error: normalized,
      });
    }
  }
}

import { describe, expect, it, vi } from "vitest";
import type { RemoteConfig } from "../src/config.js";
import { buildCommands, installAll } from "../src/install.js";
import type { CommandRunner } from "../src/run-command.js";

const TEST_CONFIG: RemoteConfig = {
  skills: [
    { sourceName: "github.com/example/cli", skillName: "example-skill" },
    { sourceName: "github.com/larksuite/cli", skillName: "lark-doc" },
  ],
  claudeCodePlugins: [{ packageName: "superpowers@claude-plugins-official" }],
};

async function waitForWrite(
  write: { mock: { calls: Array<[string | Uint8Array, ...unknown[]]> } },
  value: string,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (write.mock.calls.some(([chunk]) => chunk === value)) {
      return;
    }

    await Promise.resolve();
  }

  expect(write.mock.calls.map(([chunk]) => chunk)).toContain(value);
}

describe("buildCommands", () => {
  it("builds both skill and plugin commands from config", () => {
    const commands = buildCommands(
      {
        installSkills: true,
        installClaudeCodePlugins: true,
        agents: ["claude-code", "trae"],
      },
      TEST_CONFIG,
    );

    expect(commands).toHaveLength(3);
    expect(commands[0]).toEqual({
      target: "skill",
      label: "skills add example-skill",
      command: "skills",
      args: [
        "add",
        "github.com/example/cli",
        "--skill",
        "example-skill",
        "-g",
        "-y",
        "-a",
        "claude-code",
        "-a",
        "trae",
      ],
      skillName: "example-skill",
    });
    expect(commands[2]).toEqual({
      target: "plugin",
      label: "claude plugin install superpowers@claude-plugins-official",
      command: "claude",
      args: ["plugin", "install", "superpowers@claude-plugins-official"],
      packageName: "superpowers@claude-plugins-official",
    });
  });

  it("tags skill and plugin commands by install target", () => {
    const commands = buildCommands(
      {
        installSkills: true,
        installClaudeCodePlugins: true,
        agents: ["claude-code"],
      },
      TEST_CONFIG,
    );

    expect(commands.map((command) => command.target)).toEqual(["skill", "skill", "plugin"]);
  });
});

describe("installAll", () => {
  it("continues after failures and throws once at the end", async () => {
    const runner = vi.fn<CommandRunner>();
    runner.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      await expect(
        installAll(
          {
            installSkills: true,
            installClaudeCodePlugins: true,
            agents: ["claude-code"],
          },
          TEST_CONFIG,
          runner,
        ),
      ).rejects.toThrow("Installation failed");

      expect(runner).toHaveBeenCalledTimes(3);
      expect(stdout).not.toHaveBeenCalledWith("Installation complete.\n");
      expect(stderr).toHaveBeenCalledWith("Installation finished with 1 failure(s).\n");
      expect(stderr).toHaveBeenCalledWith("Failed commands:\n");
      expect(stderr).toHaveBeenCalledWith(" - skills add github.com/larksuite/cli --skill lark-doc -g -y -a claude-code\n");
      expect(stderr).not.toHaveBeenCalledWith("Step failed: claude plugin install superpowers@claude-plugins-official\n");
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });

  it("waits for all skill installs to settle before running plugin installs", async () => {
    let releaseFirstSkill: (() => void) | undefined;
    let releaseSecondSkill: (() => void) | undefined;
    const started: string[] = [];

    const runner: CommandRunner = (command, args, options) => {
      const fullCommand = [command, ...args].join(" ");
      started.push(`${fullCommand} [${options?.output ?? "stream"}]`);

      if (fullCommand.includes("example-skill")) {
        return new Promise<void>((resolve) => {
          releaseFirstSkill = resolve;
        });
      }

      if (fullCommand.includes("lark-doc")) {
        return new Promise<void>((resolve) => {
          releaseSecondSkill = resolve;
        });
      }

      return Promise.resolve();
    };

    const installPromise = installAll(
      {
        installSkills: true,
        installClaudeCodePlugins: true,
        agents: ["claude-code"],
      },
      TEST_CONFIG,
      runner,
    );

    await Promise.resolve();
    expect(started).toEqual([
      "skills add github.com/example/cli --skill example-skill -g -y -a claude-code [silent]",
      "skills add github.com/larksuite/cli --skill lark-doc -g -y -a claude-code [silent]",
    ]);

    releaseFirstSkill?.();
    await Promise.resolve();
    expect(started).toEqual([
      "skills add github.com/example/cli --skill example-skill -g -y -a claude-code [silent]",
      "skills add github.com/larksuite/cli --skill lark-doc -g -y -a claude-code [silent]",
    ]);

    releaseSecondSkill?.();
    await installPromise;

    expect(started).toEqual([
      "skills add github.com/example/cli --skill example-skill -g -y -a claude-code [silent]",
      "skills add github.com/larksuite/cli --skill lark-doc -g -y -a claude-code [silent]",
      "claude plugin install superpowers@claude-plugins-official [stream]",
    ]);
  });

  it("updates skill progress on a single terminal line", async () => {
    let releaseFirstSkill: (() => void) | undefined;
    let releaseSecondSkill: (() => void) | undefined;

    const runner: CommandRunner = (command, args) => {
      const fullCommand = [command, ...args].join(" ");

      if (fullCommand.includes("example-skill")) {
        return new Promise<void>((resolve) => {
          releaseFirstSkill = resolve;
        });
      }

      if (fullCommand.includes("lark-doc")) {
        return new Promise<void>((resolve) => {
          releaseSecondSkill = resolve;
        });
      }

      return Promise.resolve();
    };

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const installPromise = installAll(
        {
          installSkills: true,
          installClaudeCodePlugins: false,
          agents: ["claude-code"],
        },
        TEST_CONFIG,
        runner,
      );

      await waitForWrite(stdout, "\r\x1b[2K00/02 installing…");

      releaseFirstSkill?.();
      await waitForWrite(stdout, "\r\x1b[2K01/02 installing…");

      releaseSecondSkill?.();
      await installPromise;

      expect(stdout).toHaveBeenCalledWith("\r\x1b[2K02/02 completed");
      expect(stdout).toHaveBeenCalledWith("\n");
    } finally {
      stdout.mockRestore();
    }
  });

  it("reports failed skill commands after all skill installs finish", async () => {
    let releaseFirstSkill: (() => void) | undefined;
    let rejectSecondSkill: ((reason?: unknown) => void) | undefined;

    const runner: CommandRunner = (command, args) => {
      const fullCommand = [command, ...args].join(" ");

      if (fullCommand.includes("example-skill")) {
        return new Promise<void>((resolve) => {
          releaseFirstSkill = resolve;
        });
      }

      if (fullCommand.includes("lark-doc")) {
        return new Promise<void>((_resolve, reject) => {
          rejectSecondSkill = reject;
        });
      }

      return Promise.resolve();
    };

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const installPromise = installAll(
        {
          installSkills: true,
          installClaudeCodePlugins: false,
          agents: ["claude-code"],
        },
        TEST_CONFIG,
        runner,
      );

      await waitForWrite(stdout, "\r\x1b[2K00/02 installing…");
      releaseFirstSkill?.();
      rejectSecondSkill?.(new Error("skill failed"));

      await expect(installPromise).rejects.toThrow("Installation failed");

      expect(stdout).toHaveBeenCalledWith("\r\x1b[2K02/02 completed with failures");
      expect(stdout).toHaveBeenCalledWith("\n");
      expect(stderr).toHaveBeenCalledWith("Installation finished with 1 failure(s).\n");
      expect(stderr).toHaveBeenCalledWith("Failed commands:\n");
      expect(stderr).toHaveBeenCalledWith(" - skills add github.com/larksuite/cli --skill lark-doc -g -y -a claude-code\n");
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { RemoteConfig } from '../src/config.js';
import { buildCommands, installAll } from '../src/install.js';
import type { CommandRunner } from '../src/run-command.js';

const TEST_CONFIG: RemoteConfig = {
  skills: [
    { sourceName: 'github.com/example/cli', skillName: 'example-skill' },
    { sourceName: 'github.com/larksuite/cli', skillName: 'lark-doc' },
  ],
  claudeCodePlugins: [{ packageName: 'superpowers@claude-plugins-official' }],
};

describe('buildCommands', () => {
  it('builds both skill and plugin commands from config', () => {
    const commands = buildCommands(
      {
        installSkills: true,
        installClaudeCodePlugins: true,
        agents: ['claude-code', 'trae'],
      },
      TEST_CONFIG,
    );

    expect(commands).toHaveLength(3);
    expect(commands[0]).toEqual({
      label: 'skills add example-skill',
      command: 'skills',
      args: ['add', 'github.com/example/cli', '--skill', 'example-skill', '-g', '-y', '-a', 'claude-code', '-a', 'trae'],
    });
    expect(commands[2]).toEqual({
      label: 'claude plugin install superpowers@claude-plugins-official',
      command: 'claude',
      args: ['plugin', 'install', 'superpowers@claude-plugins-official'],
    });
  });
});

describe('installAll', () => {
  it('continues after failures and throws once at the end', async () => {
    const runner = vi.fn<CommandRunner>();
    runner.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await expect(
      installAll(
        {
          installSkills: true,
          installClaudeCodePlugins: true,
          agents: ['claude-code'],
        },
        TEST_CONFIG,
        runner,
      ),
    ).rejects.toThrow('Installation failed');

    expect(runner).toHaveBeenCalledTimes(3);
    expect(stderr).toHaveBeenCalledWith('Installation finished with 1 failure(s).\n');

    stdout.mockRestore();
    stderr.mockRestore();
  });
});

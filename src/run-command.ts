import { spawn } from 'node:child_process';

export type CommandRunner = (command: string, args: string[]) => Promise<void>;

export function createCommandRunner(
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): CommandRunner {
  return (command, args) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (chunk: Buffer) => stdout.write(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderr.write(chunk));
      child.on('error', reject);
      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
      });
    });
}

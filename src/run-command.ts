import { spawn } from "node:child_process";

export type CommandRunnerOptions = {
  output?: "stream" | "silent";
};

export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandRunnerOptions,
) => Promise<void>;

export function createCommandRunner(
  stdout: NodeJS.WritableStream = process.stdout,
  stderr: NodeJS.WritableStream = process.stderr,
): CommandRunner {
  return (command, args, options) =>
    new Promise((resolve, reject) => {
      const outputMode = options?.output ?? "stream";
      const child = spawn(command, args, {
        stdio:
          outputMode === "silent"
            ? ["ignore", "ignore", "ignore"]
            : ["ignore", "pipe", "pipe"],
      });

      if (outputMode === "stream") {
        child.stdout?.on("data", (chunk: Buffer) => stdout.write(chunk));
        child.stderr?.on("data", (chunk: Buffer) => stderr.write(chunk));
      }

      child.on("error", reject);
      child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
        if (code === 0) {
          resolve();
          return;
        }

        if (signal) {
          reject(new Error(`${command} exited with signal ${signal}`));
          return;
        }

        reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
      });
    });
}

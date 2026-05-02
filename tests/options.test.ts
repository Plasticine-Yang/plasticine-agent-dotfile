import { describe, expect, it } from "vitest";
import { ALL_AGENTS, resolveInstallRequest } from "../src/options.js";

describe("resolveInstallRequest", () => {
  it("defaults skill agents to all when skills are requested by flag", () => {
    const result = resolveInstallRequest({
      skills: true,
      claudeCodePlugins: false,
      agents: undefined,
    });

    expect(result).toEqual({
      installSkills: true,
      installClaudeCodePlugins: false,
      agents: [...ALL_AGENTS],
      needsScopePrompt: false,
      needsAgentPrompt: false,
    });
  });

  it("uses prompts when no install scope flags are provided", () => {
    const result = resolveInstallRequest({
      skills: false,
      claudeCodePlugins: false,
      agents: undefined,
    });

    expect(result).toEqual({
      installSkills: false,
      installClaudeCodePlugins: false,
      agents: [],
      needsScopePrompt: true,
      needsAgentPrompt: true,
    });
  });

  it("rejects agent flags without skills", () => {
    expect(() =>
      resolveInstallRequest({
        skills: false,
        claudeCodePlugins: true,
        agents: ["claude-code"],
      }),
    ).toThrow("--agent can only be used together with --skills");
  });
});

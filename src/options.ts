export const ALL_AGENTS = ['claude-code', 'trae', 'trae-cn'] as const;

export type AgentName = (typeof ALL_AGENTS)[number];

export type InstallFlags = {
  skills?: boolean;
  claudeCodePlugins?: boolean;
  agents?: AgentName[];
};

export type ResolvedInstallRequest = {
  installSkills: boolean;
  installClaudeCodePlugins: boolean;
  agents: AgentName[];
  needsScopePrompt: boolean;
  needsAgentPrompt: boolean;
};

export function resolveInstallRequest(flags: InstallFlags): ResolvedInstallRequest {
  if (!flags.skills && flags.agents?.length) {
    throw new Error('--agent can only be used together with --skills');
  }

  const installSkills = Boolean(flags.skills);
  const installClaudeCodePlugins = Boolean(flags.claudeCodePlugins);
  const needsScopePrompt = !installSkills && !installClaudeCodePlugins;
  const agents = installSkills ? (flags.agents?.length ? flags.agents : [...ALL_AGENTS]) : [];

  return {
    installSkills,
    installClaudeCodePlugins,
    agents,
    needsScopePrompt,
    needsAgentPrompt: needsScopePrompt,
  };
}

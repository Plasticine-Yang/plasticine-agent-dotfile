import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { cancel, intro, isCancel, multiselect, outro, select, spinner, text } from "@clack/prompts";
import { type AgentName, ALL_AGENTS, type ResolvedInstallRequest } from "./options.js";

const SCOPE_CHOICES = [
  { value: "skills", label: "Install skills" },
  { value: "claude-code-plugins", label: "Install Claude Code plugins" },
  { value: "both", label: "Install both" },
] as const;

export async function promptForConfigFilePath(): Promise<string> {
  intro("plasticine-agent-dotfile config");

  const value = await text({
    message: "Enter config file path",
    placeholder: "./plasticine-agent-dotfile.config.json",
    validate: validateConfigFilePath,
  });

  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(1);
  }

  outro("Config file path captured.");
  return resolve(value);
}

export async function promptForConfigMutationFields(
  command: "add-skill",
  values: {
    sourceName?: string;
    skillName?: string;
    packageName?: string;
  },
): Promise<{ sourceName: string; skillName: string; packageName?: string }>;
export async function promptForConfigMutationFields(
  command: "remove-skill",
  values: {
    sourceName?: string;
    skillName?: string;
    packageName?: string;
  },
): Promise<{ sourceName?: string; skillName: string; packageName?: string }>;
export async function promptForConfigMutationFields(
  command: "add-claude-code-plugin" | "remove-claude-code-plugin",
  values: {
    sourceName?: string;
    skillName?: string;
    packageName?: string;
  },
): Promise<{ sourceName?: string; skillName?: string; packageName: string }>;
export async function promptForConfigMutationFields(
  command: "add-skill" | "add-claude-code-plugin" | "remove-skill" | "remove-claude-code-plugin",
  values: {
    sourceName?: string;
    skillName?: string;
    packageName?: string;
  },
) {
  const nextValues = { ...values };

  if (command === "add-skill") {
    if (!nextValues.sourceName) {
      nextValues.sourceName = await promptForRequiredText("Enter skill source name", "github.com/larksuite/cli");
    }
    if (!nextValues.skillName) {
      nextValues.skillName = await promptForRequiredText("Enter skill name", "lark-doc");
    }
  }

  if (command === "remove-skill" && !nextValues.skillName) {
    nextValues.skillName = await promptForRequiredText("Enter skill name to remove", "lark-doc");
  }

  if ((command === "add-claude-code-plugin" || command === "remove-claude-code-plugin") && !nextValues.packageName) {
    nextValues.packageName = await promptForRequiredText(
      command === "add-claude-code-plugin"
        ? "Enter Claude Code plugin package name"
        : "Enter Claude Code plugin package name to remove",
      "superpowers@claude-plugins-official",
    );
  }

  return nextValues;
}

export async function ensureConfigFileDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function promptForMissingSelections(request: ResolvedInstallRequest): Promise<ResolvedInstallRequest> {
  let nextRequest = request;
  let prompted = false;

  if (request.needsScopePrompt) {
    prompted = true;
    intro("plasticine-agent-dotfile install");

    const selection = await select({
      message: "What would you like to install?",
      options: [...SCOPE_CHOICES],
    });

    if (isCancel(selection)) {
      cancel("Installation cancelled.");
      process.exit(1);
    }

    nextRequest = {
      ...nextRequest,
      installSkills: selection === "skills" || selection === "both",
      installClaudeCodePlugins: selection === "claude-code-plugins" || selection === "both",
      agents: selection === "claude-code-plugins" ? [] : [...ALL_AGENTS],
      needsScopePrompt: false,
      needsAgentPrompt: selection === "skills" || selection === "both",
    };
  }

  if (nextRequest.installSkills && nextRequest.needsAgentPrompt) {
    if (!prompted) {
      prompted = true;
      intro("plasticine-agent-dotfile install");
    }

    const selectedAgents = await multiselect<AgentName>({
      message: "Which agents should receive the skills?",
      options: ALL_AGENTS.map((agent) => ({
        value: agent,
        label: agent,
      })),
      initialValues: [...ALL_AGENTS],
      required: true,
    });

    if (isCancel(selectedAgents)) {
      cancel("Installation cancelled.");
      process.exit(1);
    }

    nextRequest = {
      ...nextRequest,
      agents: selectedAgents,
      needsAgentPrompt: false,
    };
  }

  if (prompted) {
    outro("Selections ready.");
  }

  return nextRequest;
}

export function createConfigLoaderSpinner() {
  return spinner();
}

function validateConfigFilePath(value: string | undefined) {
  if (!value) {
    return "Enter a valid config file path";
  }

  return undefined;
}

async function promptForRequiredText(message: string, placeholder: string): Promise<string> {
  const value = await text({
    message,
    placeholder,
    validate: (currentValue) => (currentValue ? undefined : "This field is required"),
  });

  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(1);
  }

  return value;
}

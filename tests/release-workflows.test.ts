import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "..");

async function readFileFromRepository(relativePath: string) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

async function fileExistsInRepository(relativePath: string) {
  try {
    await access(resolve(repositoryRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

describe("release workflows", () => {
  it("ignores the generated changeset README when checking for unconsumed changesets", async () => {
    const workflow = await readFileFromRepository(".github/workflows/release.yml");

    expect(workflow).toContain("find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' -print -quit | grep -q .");
  });

  it("publishes latest only after merged pull requests to main or manual dispatch", async () => {
    const workflow = await readFileFromRepository(".github/workflows/release.yml");

    expect(workflow).toContain("pull_request_target:");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("branches:\n      - main");
    expect(workflow).toContain("types:\n      - closed");
    expect(workflow).toContain(
      "if: github.event_name == 'workflow_dispatch' || github.event.pull_request.merged == true",
    );
    expect(workflow).toContain("pnpm release:publish");
    expect(workflow).toContain("find .changeset -maxdepth 1 -name");
    expect(workflow).toContain("subject: $" + "{{ steps.release.outputs.email_subject }}");
    expect(workflow).toContain("html_body: $" + "{{ steps.release.outputs.email_html }}");
  });

  it("publishes preview packages manually through the preview script and smtp email", async () => {
    const workflow = await readFileFromRepository(".github/workflows/preview-release.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("pnpm release:publish:preview");
    expect(workflow).toContain("SMTP_HOST");
    expect(workflow).toContain("SMTP_PORT");
    expect(workflow).toContain("SMTP_USERNAME");
    expect(workflow).toContain("SMTP_PASSWORD");
    expect(workflow).toContain("subject: $" + "{{ steps.release.outputs.email_subject }}");
    expect(workflow).toContain("html_body: $" + "{{ steps.release.outputs.email_html }}");
  });

  it("runs release scripts directly from TypeScript entrypoints and preserves GitHub output fields", async () => {
    const packageJson = await readFileFromRepository("package.json");
    const publishReleaseScriptExists = await fileExistsInRepository("scripts/publish-release.ts");
    const publishPreviewScriptExists = await fileExistsInRepository("scripts/publish-preview-release.ts");

    expect(packageJson).toContain('"release:publish": "tsx ./scripts/publish-release.ts"');
    expect(packageJson).toContain('"release:publish:preview": "tsx ./scripts/publish-preview-release.ts"');
    expect(packageJson).toContain('"tsx": "latest"');
    await expect(fileExistsInRepository("scripts/publish-release.ts")).resolves.toBe(true);
    await expect(fileExistsInRepository("scripts/publish-preview-release.ts")).resolves.toBe(true);

    if (publishReleaseScriptExists) {
      const publishReleaseScript = await readFileFromRepository("scripts/publish-release.ts");
      expect(publishReleaseScript).toContain('from "./release-email"');
      expect(publishReleaseScript).toContain("email_subject=${" + "emailSubject}");
      expect(publishReleaseScript).toContain("email_html<<${" + "outputDelimiter}");
    }

    if (publishPreviewScriptExists) {
      const publishPreviewScript = await readFileFromRepository("scripts/publish-preview-release.ts");
      expect(publishPreviewScript).toContain('from "./release-email"');
      expect(publishPreviewScript).toContain("email_subject=${" + "emailSubject}");
      expect(publishPreviewScript).toContain("email_html<<${" + "outputDelimiter}");
    }
  });
});

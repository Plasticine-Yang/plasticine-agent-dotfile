import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, '..');

async function readFileFromRepository(relativePath: string) {
  return readFile(resolve(repositoryRoot, relativePath), 'utf8');
}

describe('release workflows', () => {
  it('publishes latest only after merged pull requests to main or manual dispatch', async () => {
    const workflow = await readFileFromRepository('.github/workflows/release.yml');

    expect(workflow).toContain('pull_request_target:');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("branches:\n      - main");
    expect(workflow).toContain("types:\n      - closed");
    expect(workflow).toContain("if: github.event_name == 'workflow_dispatch' || github.event.pull_request.merged == true");
    expect(workflow).toContain('pnpm release:publish');
    expect(workflow).toContain('find .changeset -maxdepth 1 -name');
    expect(workflow).toContain('Package: ${{ steps.release.outputs.package_name }}');
    expect(workflow).toContain('Dist-tag: ${{ steps.release.outputs.dist_tag }}');
    expect(workflow).toContain('Version: ${{ steps.release.outputs.version }}');
    expect(workflow).toContain('Commit: ${{ steps.release.outputs.commit }}');
  });

  it('publishes preview packages manually through the preview script and smtp email', async () => {
    const workflow = await readFileFromRepository('.github/workflows/preview-release.yml');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('pnpm release:publish:preview');
    expect(workflow).toContain('SMTP_HOST');
    expect(workflow).toContain('SMTP_PORT');
    expect(workflow).toContain('SMTP_USERNAME');
    expect(workflow).toContain('SMTP_PASSWORD');
    expect(workflow).toContain('Package: ${{ steps.release.outputs.package_name }}');
    expect(workflow).toContain('Dist-tag: ${{ steps.release.outputs.dist_tag }}');
    expect(workflow).toContain('Version: ${{ steps.release.outputs.version }}');
    expect(workflow).toContain('Commit: ${{ steps.release.outputs.commit }}');
  });

  it('uses publish scripts that derive release metadata from the package file', async () => {
    const packageJson = await readFileFromRepository('package.json');

    expect(packageJson).toContain('"release:publish": "node ./scripts/publish-release.mjs"');
    expect(packageJson).toContain('"release:publish:preview": "node ./scripts/publish-preview-release.mjs"');
  });
});

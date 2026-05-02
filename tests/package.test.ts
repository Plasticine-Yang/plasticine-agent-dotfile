import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

const testDirectory = dirname(fileURLToPath(import.meta.url));

describe("package metadata", () => {
  it("publishes the expected package and bin names", () => {
    expect(packageJson.name).toBe("plasticine-agent-dotfile");
    expect(packageJson.bin).toEqual({
      "plasticine-agent-dotfile": "dist/cli.js",
      pad: "dist/cli.js",
    });
  });

  it("publishes only the built cli artifacts", () => {
    expect(packageJson.files).toEqual(["dist", "README.md", "CHANGELOG.md"]);
    expect(packageJson.scripts).toMatchObject({
      prepack: "pnpm build",
      prepublishOnly: "pnpm release:check",
      lint: "biome check .",
      "lint:fix": "biome check . --write",
      format: "biome format . --write",
      "format:check": "biome format .",
      check: "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test",
      "release:check": "pnpm check",
      changeset: "changeset",
      "changeset:version": "changeset version",
      "release:publish": "node ./scripts/publish-release.mjs",
      "release:publish:preview": "node ./scripts/publish-preview-release.mjs",
    });
  });

  it("pins publishing to the npmjs registry", async () => {
    const npmrc = await readFile(resolve(testDirectory, "../.npmrc"), "utf8");
    expect(npmrc).toContain("registry=https://registry.npmjs.org/");
  });
});

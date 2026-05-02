import { describe, expect, it } from "vitest";
import { createReleaseEmail } from "../scripts/release-email";

describe("createReleaseEmail", () => {
  it("renders escaped content and omits commit link without repository", () => {
    const email = createReleaseEmail({
      packageName: "@scope/pkg",
      version: "1.0.0<beta>",
      distTag: "latest&stable",
      commit: "abc123",
      repository: "",
    });

    expect(email.subject).toBe("@scope/pkg@1.0.0<beta> published to npm (latest&stable)");
    expect(email.htmlBody).toContain("https://www.npmjs.com/package/%40scope%2Fpkg");
    expect(email.htmlBody).toContain("1.0.0&lt;beta&gt;");
    expect(email.htmlBody).toContain("latest&amp;stable");
    expect(email.htmlBody).not.toContain("View commit");
  });

  it("renders commit link when repository is available", () => {
    const email = createReleaseEmail({
      packageName: "plasticine-agent-dotfile",
      version: "0.2.0",
      distTag: "latest",
      commit: "deadbeef",
      repository: "owner/repo",
    });

    expect(email.htmlBody).toContain("https://github.com/owner/repo/commit/deadbeef");
    expect(email.htmlBody).toContain("View commit");
  });
});

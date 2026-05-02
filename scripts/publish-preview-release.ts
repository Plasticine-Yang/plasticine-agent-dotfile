#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { createReleaseEmail } from "./release-email";

const ref = process.env.PREVIEW_REF;
if (!ref) {
  throw new Error("PREVIEW_REF is required");
}

const sanitizedBranch =
  ref
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-") || "preview";
const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);

const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8"));
const originalVersion = packageJson.version;
const previewVersion = `${originalVersion}-${sanitizedBranch}-${timestamp}`;
const commit = process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const repository = process.env.GITHUB_REPOSITORY ?? "";
const githubOutput = process.env.GITHUB_OUTPUT;

packageJson.version = previewVersion;
writeFileSync(packageJsonUrl, `${JSON.stringify(packageJson, null, 2)}\n`);

try {
  execFileSync(
    "npm",
    ["publish", "--tag", sanitizedBranch, "--access", "public", "--registry", "https://registry.npmjs.org/"],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
} finally {
  packageJson.version = originalVersion;
  writeFileSync(packageJsonUrl, `${JSON.stringify(packageJson, null, 2)}\n`);
}

const { subject: emailSubject, htmlBody: emailHtml } = createReleaseEmail({
  packageName: packageJson.name,
  version: previewVersion,
  distTag: sanitizedBranch,
  commit,
  repository,
});

if (githubOutput) {
  const outputDelimiter = `EMAIL_HTML_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  appendFileSync(githubOutput, `package_name=${packageJson.name}\n`);
  appendFileSync(githubOutput, `dist_tag=${sanitizedBranch}\n`);
  appendFileSync(githubOutput, `version=${previewVersion}\n`);
  appendFileSync(githubOutput, `commit=${commit}\n`);
  appendFileSync(githubOutput, `email_subject=${emailSubject}\n`);
  appendFileSync(githubOutput, `email_html<<${outputDelimiter}\n${emailHtml}\n${outputDelimiter}\n`);
}

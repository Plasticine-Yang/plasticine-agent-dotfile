#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { createReleaseEmail } from "./release-email";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageName = packageJson.name;
const version = packageJson.version;
const distTag = process.env.RELEASE_DIST_TAG ?? "latest";
const commit = process.env.GITHUB_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const repository = process.env.GITHUB_REPOSITORY ?? "";
const githubOutput = process.env.GITHUB_OUTPUT;

execFileSync("npm", ["publish", "--tag", distTag, "--access", "public", "--registry", "https://registry.npmjs.org/"], {
  stdio: "inherit",
  env: process.env,
});

const { subject: emailSubject, htmlBody: emailHtml } = createReleaseEmail({
  packageName,
  version,
  distTag,
  commit,
  repository,
});

if (githubOutput) {
  const outputDelimiter = `EMAIL_HTML_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  appendFileSync(githubOutput, `package_name=${packageName}\n`);
  appendFileSync(githubOutput, `dist_tag=${distTag}\n`);
  appendFileSync(githubOutput, `version=${version}\n`);
  appendFileSync(githubOutput, `commit=${commit}\n`);
  appendFileSync(githubOutput, `email_subject=${emailSubject}\n`);
  appendFileSync(githubOutput, `email_html<<${outputDelimiter}\n${emailHtml}\n${outputDelimiter}\n`);
}

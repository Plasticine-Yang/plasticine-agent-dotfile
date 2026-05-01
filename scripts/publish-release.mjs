#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageName = packageJson.name;
const version = packageJson.version;
const distTag = process.env.RELEASE_DIST_TAG ?? 'latest';
const commit = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const githubOutput = process.env.GITHUB_OUTPUT;

execFileSync('npm', ['publish', '--tag', distTag, '--access', 'public', '--registry', 'https://registry.npmjs.org/'], {
  stdio: 'inherit',
  env: process.env,
});

if (githubOutput) {
  appendFileSync(githubOutput, `package_name=${packageName}\n`);
  appendFileSync(githubOutput, `dist_tag=${distTag}\n`);
  appendFileSync(githubOutput, `version=${version}\n`);
  appendFileSync(githubOutput, `commit=${commit}\n`);
}

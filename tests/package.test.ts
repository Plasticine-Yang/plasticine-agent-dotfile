import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('package metadata', () => {
  it('publishes the expected package and bin names', () => {
    expect(packageJson.name).toBe('plasticine-agent-dotfile');
    expect(packageJson.bin).toEqual({
      'plasticine-agent-dotfile': './dist/cli.js',
      pad: './dist/cli.js',
    });
  });
});

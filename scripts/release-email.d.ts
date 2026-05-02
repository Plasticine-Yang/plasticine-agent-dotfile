export type ReleaseEmailInput = {
  packageName: string;
  version: string;
  distTag: string;
  commit?: string;
  repository?: string;
};

export type ReleaseEmail = {
  subject: string;
  htmlBody: string;
};

export function createReleaseEmail(input: ReleaseEmailInput): ReleaseEmail;

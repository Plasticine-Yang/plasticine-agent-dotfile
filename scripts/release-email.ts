function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createPackageUrl(packageName: string) {
  return `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`;
}

function createCommitUrl(repository: string | undefined, commitSha: string | undefined) {
  if (!repository?.includes("/") || !commitSha) {
    return null;
  }

  return `https://github.com/${repository}/commit/${commitSha}`;
}

export type ReleaseEmailInput = {
  packageName: string;
  version: string;
  distTag: string;
  commit?: string;
  repository?: string;
};

export function createReleaseEmail({ packageName, version, distTag, commit, repository }: ReleaseEmailInput) {
  const escapedPackageName = escapeHtml(packageName);
  const escapedVersion = escapeHtml(version);
  const escapedDistTag = escapeHtml(distTag);
  const escapedCommit = commit ? escapeHtml(commit) : null;

  const packageUrl = createPackageUrl(packageName);
  const commitUrl = createCommitUrl(repository, commit);

  const subject = `${packageName}@${version} published to npm (${distTag})`.replace(/[\r\n]+/g, " ");

  const htmlBody = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 8px 24px;font-size:20px;font-weight:600;line-height:1.4;">Release published</td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px 24px;font-size:14px;line-height:1.6;color:#334155;">
                <div><strong>Package:</strong> ${escapedPackageName}</div>
                <div><strong>Version:</strong> ${escapedVersion}</div>
                <div><strong>Dist-tag:</strong> ${escapedDistTag}</div>
                ${escapedCommit ? `<div><strong>Commit:</strong> ${escapedCommit}</div>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px;">
                <a href="${escapeHtml(packageUrl)}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">View package</a>
                ${commitUrl ? `<a href="${escapeHtml(commitUrl)}" style="display:inline-block;margin-left:10px;padding:10px 14px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">View commit</a>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject,
    htmlBody,
  };
}

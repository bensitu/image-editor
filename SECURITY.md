# Security Policy

This policy covers `@bensitu/image-editor`, the accompanying
`@bensitu/image-editor-codemod`, and code maintained in this repository.

## Supported versions

| Release line                      | Security support                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| Latest 3.x release                | Supported; fixes target the current release line on `main`.                         |
| Latest 2.x maintenance release    | Security and critical correctness fixes only, maintained separately on `legacy/v2`. |
| Older releases within either line | Upgrade to the latest release in that line.                                         |
| 1.x and earlier                   | Unsupported.                                                                        |

Development branches and prereleases are not stable releases. Reports affecting
them are welcome, but users should use a supported stable release in production.
Fixes affecting both supported lines are reviewed and applied separately; changes
are not automatically merged between `main` and `legacy/v2`.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through
[GitHub's vulnerability reporting form](https://github.com/bensitu/image-editor/security/advisories/new).
A GitHub account is required. You can also open the repository's
[Security Advisories page](https://github.com/bensitu/image-editor/security/advisories)
and select **Report a vulnerability**.

Do not disclose vulnerability details in public issues, discussions, or pull
requests before a fix or coordinated disclosure is ready. If the private report
form is unavailable, open an issue asking only for a private security contact,
without including technical details or sensitive attachments.

Include the following where possible:

- Affected package names, versions, and relevant repository commits.
- A description of the issue, its impact, and the conditions needed to exploit it.
- Minimal reproduction steps or a proof of concept using synthetic data.
- The browser or Node.js version, operating system, and relevant dependencies
  such as Fabric.js or installed plugins.
- Any suggested mitigation or fix, and whether the issue has been disclosed
  elsewhere.

Remove credentials, personal information, and private images or documents from
reports. Test only on systems and data you own or have permission to assess.

## Handling and disclosure

Maintainers review reports privately, request clarification when needed, and
assess affected versions and possible mitigations. For confirmed vulnerabilities,
maintainers coordinate a fix and disclosure with the reporter and publish a
security advisory when appropriate. Reporter credit is subject to the reporter's
consent.

Response and remediation are on a best-effort basis; there is no guaranteed
response time or resolution deadline. Please follow up in the private report if
you have not received a response. Keep exploit details private while coordinating
disclosure with maintainers.

## Scope and security boundaries

Reports may concern image and snapshot import, exported content, redaction,
resource exhaustion, dependency vulnerabilities, or repository build and release
processes. For dependency findings, include the affected dependency path and how
the vulnerable behavior can be reached, if known.

Plugins execute as application code. Plugin permissions and SDK checks are not a
security sandbox for untrusted plugins; applications should install only trusted
code. For details, see the [Plugin Author Guide](docs/guides/plugin-authoring.md).

For bugs without a security impact, feature requests, or usage questions, use
[GitHub Issues](https://github.com/bensitu/image-editor/issues).

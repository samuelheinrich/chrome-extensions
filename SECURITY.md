# Security Policy

## Supported Versions

Security fixes are provided for the latest published Bookmark Wizard version.

## Reporting A Vulnerability

Please report security issues through the support contact or private channel listed in the Chrome Web Store listing. Do not include sensitive bookmark exports or private URLs in public issues.

Useful reports include:

- A short description of the issue.
- Steps to reproduce.
- Browser and operating system version.
- Whether the issue affects bookmark data integrity, permissions, local storage or deadlink checks.

## Security Design Notes

- Bookmark Wizard is Manifest V3 based.
- Bookmark Wizard does not execute remote code.
- Deadlink checks are user-initiated and require optional host permissions.
- Private/local hosts are skipped by default.
- Backup imports should be reviewed before applying changes.

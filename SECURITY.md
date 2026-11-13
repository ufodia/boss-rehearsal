# Security policy

## Sensitive boundaries

Security-sensitive areas include imported lesson validation, embedded video handling, authored-text escaping, standalone export generation and dependency integration.

Only the current main source is maintained at this stage. There is no promised response time or long-term support branch.

## Report privately

Use [Report a vulnerability](https://github.com/ufodia/boss-rehearsal/security/advisories/new). Private vulnerability reporting is enabled for this repository. Do not publish exploit details or private video/lesson content in an issue.

If that private channel is unavailable, ask the maintainer for a private reporting route without sensitive details. Provide the affected commit, reproduction steps, impact and a minimal synthetic lesson through the private route.

## Local file boundary

Imported recordings and exported trainers can contain private original footage. The application does not redact that content. Use [privacy.md](docs/privacy.md) before sharing portable files or reproduction evidence.

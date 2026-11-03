# Changelog

## 1.3.1

- Public domain/IP endpoints require HTTPS; private/loopback HTTP remains supported. Normal certificate verification is retained.
- Add a read-only connection test with latency and actionable DNS, port, TLS, key, permission, upload-size, rate-limit and reverse-proxy errors.
- Limit active file sync work to two files before reading contents. Connection setup is bounded to 15 seconds; request limit remains 90 seconds.
- Preserve stable document associations, guarded updates, uncertain-write reconciliation and manual-edit protection.
- 56 automated tests pass; English and Chinese setup instructions are updated.



## 1.3.0

- Use Obsidian SecretStorage and editable connection settings; remove runtime PowerShell/DPAPI dependency.
- Keep commands and file menus available when connection setup fails.
- Add configurable intake/published folders and opt-in completed-file archiving.
- Journal file moves and preserve stable document associations through recovery.
- Prevent uploads during reconnection or unresolved move recovery.
- Package a public-safe client with tests, licensing, CI and explicit server extension requirements.

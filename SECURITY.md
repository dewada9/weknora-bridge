# Security

This project sends user-selected content and the configured scoped API key to the configured server. It has no telemetry and no built-in proxy. Use TLS or a trusted private network. Use the least-privileged key supported by your server.

Keys are accessed using Obsidian SecretStorage. Data.json contains publication records, paths and source identities and can still be private; it is not a public diagnostic attachment. Never post vault contents or keys in an issue.

Do not disclose exploitable details publicly. Once the maintainer enables private vulnerability reporting on the published repository, use that channel. Until a public maintainer and reporting channel are established, treat this as an early candidate and do not deploy it in a shared production environment.

Supported branch: 1.3.x candidate. No security audit or multi-tenant server compatibility certification is claimed.

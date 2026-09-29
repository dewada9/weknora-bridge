# Contributing

Discuss behavior changes with a minimal reproducible example. Add a regression test before modifying synchronization or recovery logic, then run `npm test` and `npm run build`. Use disposable test data and a scoped test key for server integration.

Preserve these invariants: explicit publication consent, stable source/document identity, guarded remote replacement, no automatic remote deletion, no overwrite of user edits and no credentials in logs or repository files. Keep core behavior independent from Obsidian UI so it is testable without a real account.

Do not include personal URLs, file paths, vault contents, tokens or runtime data.json in issues or pull requests. Describe server API/version requirements and platform testing accurately.

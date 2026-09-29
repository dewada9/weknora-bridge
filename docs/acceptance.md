# Release acceptance

- [ ] Clean install: settings and menus exist without credentials; no file is automatically uploaded.
- [ ] Configure a scoped API key through SecretStorage; reconnect after app restart and OS reboot.
- [ ] Unavailable/missing secret leaves settings, commands and right-click actions available.
- [ ] Offline startup resumes without duplicate documents after network recovery.
- [ ] Intake publication moves only after completed parsing; edited and failed files remain.
- [ ] Same-name published file is never overwritten; folder hierarchy survives.
- [ ] Restart after rename but before state save recovers the same document ID.
- [ ] Edit/move a published file and verify the same ID and updated contents remotely.
- [ ] Remote edit is detected and stops replacement; unsupported update API never deletes the document.
- [ ] Delete local file and confirm the remote document remains.
- [ ] Graph import preserves manual edits and never re-uploads generated notes.
- [ ] Confirm API credentials never enter plugin data.json, logs or release assets.
- [ ] Run unit tests/build and inspect the three release assets.
- [ ] Verify server extensions on the intended WeKnora version; record that version.
- [ ] Perform target-platform tests before claiming macOS/Linux support. Mobile remains disabled.
- [ ] Choose a public maintainer/repository, create a tagged GitHub release, then submit to the official community directory.

The checklist is intentionally unchecked in the reusable project: local test evidence for one private installation is not a release guarantee for another environment.

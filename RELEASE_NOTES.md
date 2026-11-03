# WeKnora Bridge 1.3.5

Optional original media cache: completed PDFs display in Obsidian with original pages and vector diagrams; DOCX embedded raster images display in first-reference order, with unreferenced objects labeled separately. Original files remain available locally. Source cards link to the prepared media pages.

Enable “下载原文并显示插图” in settings. Downloads use the existing authenticated knowledge API, verify original MD5 and current knowledge scope/version, refuse redirects, and are capped at 25 MiB per original. Cache files never upload back to WeKnora. Changed local files are preserved. ZIP extraction rejects unsafe paths, encryption, unsupported containers and oversized expanded content.

Work rotates over at most 20 eligible documents per refresh with a time budget; network/auth/rate-limit failures stop the batch. Disable the switch to stop subsequent writes. Existing cached previews remain readable offline. Originals may also sync through your vault sync provider.

85 automated tests pass. Desktop only; Windows tested. Word pagination is not inferred; unsupported embedded formats are reported. This adds original-image display, not OCR or image vector indexing. No automatic bulk reparse or model calls.

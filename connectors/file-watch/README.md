# file-watch

**Status:** MVP in gateway (`apps/gateway/src/file-watch.ts`)

## Setup

1. Create a folder, e.g. `~/qev-watch`
2. Set in settings / env later, or put `watch_dir` on photo_file connector in `data/config/settings.json`:

```json
"photo_file": {
  "enabled": true,
  "status": "healthy",
  "watch_dir": "/Users/you/qev-watch"
}
```

3. Drop files under:

```text
qev-watch/JOB-123/before/site.jpg
qev-watch/JOB-123/after/done.jpg
```

Or use `JOB-123` in the filename. Files are hashed (SHA-256), matched to a case, and ingested as evidence events. Incomplete writes (recent mtime) are skipped.

## What it does not do

- Cloud Drive OAuth (P2)
- Rewrite sealed packages (uses supplemental path when late)

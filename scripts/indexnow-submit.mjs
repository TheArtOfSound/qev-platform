#!/usr/bin/env node
/**
 * IndexNow submission helper (Bing & participants).
 * A 200/202 only means the notification was *received* — not crawled or ranked.
 *
 * Usage:
 *   INDEXNOW_KEY=... node scripts/indexnow-submit.mjs https://secure.imagineqira.com/trust/
 *   INDEXNOW_KEY=... node scripts/indexnow-submit.mjs --file urls.txt
 *
 * Key file must be live at:
 *   https://secure.imagineqira.com/<KEY>.txt  (body = KEY)
 */
import { readFile } from "node:fs/promises";

const key = process.env.INDEXNOW_KEY;
const host = process.env.INDEXNOW_HOST ?? "secure.imagineqira.com";
const endpoint =
  process.env.INDEXNOW_ENDPOINT ?? "https://api.indexnow.org/indexnow";

if (!key) {
  console.error("Set INDEXNOW_KEY");
  process.exit(2);
}

async function collectUrls() {
  const args = process.argv.slice(2);
  if (args[0] === "--file" && args[1]) {
    const text = await readFile(args[1], "utf8");
    return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  return args.filter((a) => a.startsWith("http"));
}

const urlList = await collectUrls();
if (!urlList.length) {
  console.error("Provide URLs or --file urls.txt");
  process.exit(2);
}

const body = {
  host,
  key,
  keyLocation: `https://${host}/${key}.txt`,
  urlList: urlList.slice(0, 10000),
};

const res = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(
  JSON.stringify(
    {
      status: res.status,
      ok: res.ok,
      body: text.slice(0, 500),
      submitted: body.urlList.length,
      note: "Success means notification received, not indexing guarantee",
    },
    null,
    2,
  ),
);
process.exit(res.ok ? 0 : 1);

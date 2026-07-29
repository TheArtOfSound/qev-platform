#!/usr/bin/env node
/**
 * Submit secure.imagineqira.com sitemaps via logged-in Chrome CDP (port 9222).
 * Uses the same approach as autohustle-seo scripts.
 */
import { chromium } from "/Users/bry/groking/autohustle-seo/node_modules/playwright/index.mjs";
import fs from "fs";

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const HOST = "secure.imagineqira.com";
const SITEMAPS = [
  `https://${HOST}/sitemap.xml`,
  `https://${HOST}/sitemap-index.xml`,
  `https://${HOST}/sitemap-pages.xml`,
  `https://${HOST}/sitemap-docs.xml`,
  `https://${HOST}/sitemap-trust.xml`,
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { ts: new Date().toISOString(), host: HOST, gsc: {}, bing: {} };

async function main() {
  console.log("Connecting CDP", CDP);
  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0] || (await browser.newContext());
  let page = context.pages()[0] || (await context.newPage());

  // ---- GSC: try URL-prefix property first, then domain ----
  const gscCandidates = [
    `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(
      `https://${HOST}/`,
    )}`,
    `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(
      `sc-domain:${HOST}`,
    )}`,
    `https://search.google.com/search-console?resource_id=${encodeURIComponent(
      `https://${HOST}/`,
    )}`,
    "https://search.google.com/search-console",
  ];

  let gscReady = false;
  for (const url of gscCandidates) {
    console.log("GSC open", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(4000);
    const text = await page.locator("body").innerText().catch(() => "");
    const title = await page.title();
    console.log(" title:", title);
    console.log(" snippet:", text.slice(0, 400).replace(/\n/g, " | "));
    results.gsc.probe = results.gsc.probe || [];
    results.gsc.probe.push({
      url: page.url(),
      title,
      snippet: text.slice(0, 800),
    });

    if (/sign in|Choose an account|Sign in/i.test(text) && !/Sitemaps|sitemap|Search Console/i.test(text)) {
      console.log("Google login required in CDP Chrome window — click your account if shown");
      // try account chip
      const acc = page.locator('[data-email], [data-identifier]').first();
      if (await acc.count()) {
        await acc.click().catch(() => {});
        await sleep(5000);
      }
    }

    if (/Sitemaps|Add a new sitemap|sitemap/i.test(text) || /search-console\/sitemaps/i.test(page.url())) {
      gscReady = true;
      break;
    }
    // property missing — try add property flow from home
    if (/Add property|add property|User isn't a verified owner|doesn't have access/i.test(text)) {
      results.gsc.needsAddProperty = true;
    }
  }

  if (gscReady || true) {
    // Attempt sitemap submits on whatever sitemaps page we're on
    // Navigate explicitly to URL-prefix sitemaps if possible
    const smUrl = `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(
      `https://${HOST}/`,
    )}`;
    await page.goto(smUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(3000);

    for (const sm of SITEMAPS) {
      console.log("GSC submit", sm);
      try {
        await page.goto(smUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        await sleep(2000);
        // Reveal add field
        await page.getByText(/Add a new sitemap/i).first().click({ timeout: 4000 }).catch(() => {});
        await sleep(600);
        const inputs = page.locator('input[type="text"], input:not([type]), input[aria-label*="sitemap" i]');
        const n = await inputs.count();
        let input = null;
        for (let i = 0; i < n; i++) {
          const el = inputs.nth(i);
          if (await el.isVisible().catch(() => false)) {
            input = el;
            break;
          }
        }
        if (!input) {
          results.gsc[sm] = { ok: false, error: "no input" };
          console.log("  no input");
          continue;
        }
        // Prefer full URL; also try path-only
        const pathOnly = sm.replace(`https://${HOST}/`, "");
        await input.click({ force: true });
        await input.fill("");
        await input.fill(sm);
        await sleep(200);
        const submit = page.getByRole("button", { name: /^submit$/i });
        let clicked = false;
        const sc = await submit.count();
        for (let i = 0; i < sc; i++) {
          const b = submit.nth(i);
          if (await b.isVisible().catch(() => false)) {
            await b.click();
            clicked = true;
            break;
          }
        }
        if (!clicked) await input.press("Enter");
        await sleep(2500);
        // If failed, retry path-only
        let body = await page.locator("body").innerText().catch(() => "");
        if (/couldn.?t fetch|invalid|error|not found/i.test(body) && pathOnly !== sm) {
          await input.fill("");
          await input.fill(pathOnly);
          await sleep(200);
          if (await submit.count()) {
            for (let i = 0; i < (await submit.count()); i++) {
              const b = submit.nth(i);
              if (await b.isVisible().catch(() => false)) {
                await b.click();
                break;
              }
            }
          } else await input.press("Enter");
          await sleep(2500);
          body = await page.locator("body").innerText().catch(() => "");
        }
        results.gsc[sm] = {
          ok: true,
          page: page.url(),
          note: body.slice(0, 300).replace(/\n/g, " "),
        };
        console.log("  done");
      } catch (e) {
        results.gsc[sm] = { ok: false, error: String(e).slice(0, 400) };
        console.log("  err", e.message || e);
      }
    }
  }

  // ---- Bing Webmaster ----
  console.log("=== Bing Webmaster ===");
  try {
    await page.goto("https://www.bing.com/webmasters/home", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await sleep(4000);
    let text = await page.locator("body").innerText().catch(() => "");
    results.bing.home = text.slice(0, 800);
    console.log("Bing snippet:", text.slice(0, 400).replace(/\n/g, " | "));

    if (/Sign in|sign in|Microsoft account/i.test(text) && !/Webmaster|Dashboard|My sites/i.test(text)) {
      results.bing.loginRequired = true;
      console.log("Bing login required in CDP Chrome");
    }

    // Try open site / sitemaps
    const bingSitemaps = [
      `https://www.bing.com/webmasters/sitemaps?siteUrl=https://${HOST}/`,
      `https://www.bing.com/webmasters/home?siteUrl=https://${HOST}`,
      "https://www.bing.com/webmasters",
    ];
    for (const bu of bingSitemaps) {
      await page.goto(bu, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(3000);
      text = await page.locator("body").innerText().catch(() => "");
      console.log("Bing page", page.url(), text.slice(0, 250).replace(/\n/g, " | "));
      results.bing.pages = results.bing.pages || [];
      results.bing.pages.push({ url: page.url(), snippet: text.slice(0, 500) });
      if (/sitemap|Submit/i.test(text)) break;
    }

    // Try submit primary sitemap
    const sm = `https://${HOST}/sitemap.xml`;
    try {
      await page.getByText(/Submit sitemap|Add sitemap|submit a sitemap/i).first().click({ timeout: 5000 }).catch(() => {});
      await sleep(800);
      const inputs = page.locator("input[type=text], input:not([type]), textarea");
      const n = await inputs.count();
      let filled = false;
      for (let i = 0; i < n; i++) {
        const el = inputs.nth(i);
        if (await el.isVisible().catch(() => false)) {
          await el.fill(sm);
          filled = true;
          break;
        }
      }
      if (filled) {
        const btn = page.getByRole("button", { name: /submit|add|save/i }).first();
        if (await btn.count()) await btn.click().catch(() => {});
        else await page.keyboard.press("Enter");
        await sleep(2500);
        results.bing.submit = { ok: true, sm };
      } else {
        results.bing.submit = { ok: false, error: "no bing input" };
      }
    } catch (e) {
      results.bing.submit = { ok: false, error: String(e).slice(0, 300) };
    }
  } catch (e) {
    results.bing.error = String(e).slice(0, 400);
  }

  const out = "/tmp/qev-gsc-bing-results.json";
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log("Wrote", out);
  console.log(JSON.stringify(results, null, 2).slice(0, 4000));
  // keep browser open
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Prefer Bing's "Import from Google Search Console" for secure.imagineqira.com
 * since GSC ownership is already verified.
 */
import { chromium } from "/Users/bry/groking/autohustle-seo/node_modules/playwright/index.mjs";

const CDP = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.connectOverCDP(CDP);
  const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage());

  const urls = [
    "https://www.bing.com/webmasters/about",
    "https://www.bing.com/webmasters/home",
    "https://www.bing.com/webmasters/addsite",
    "https://www.bing.com/webmasters",
  ];

  for (const u of urls) {
    console.log("OPEN", u);
    await page.goto(u, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await sleep(2500);
    const t = await page.locator("body").innerText().catch(() => "");
    console.log(page.url(), t.slice(0, 400).replace(/\n/g, " | "));
  }

  // Click any import / Google Search Console related control
  const clicks = [
    /Import from Google Search Console/i,
    /Google Search Console/i,
    /Import sites/i,
    /Add a site/i,
    /Add site/i,
    /Get started/i,
  ];
  for (const re of clicks) {
    const loc = page.getByText(re);
    if (await loc.count()) {
      console.log("click", re);
      await loc.first().click({ timeout: 5000 }).catch((e) => console.log("click fail", e.message));
      await sleep(3000);
      console.log(
        "after",
        page.url(),
        (await page.locator("body").innerText()).slice(0, 700).replace(/\n/g, " | "),
      );
    }
  }

  // Site selector / dropdown for imagines
  const select = page.locator("select, [role=listbox], [aria-haspopup=listbox]");
  console.log("selects", await select.count());

  // Dump links that might add sites
  const hrefs = await page.$$eval("a", (as) =>
    as
      .map((a) => ({ href: a.href, text: (a.innerText || "").trim().slice(0, 80) }))
      .filter((x) => /add|import|google|site/i.test(x.text + x.href))
      .slice(0, 40),
  );
  console.log("links", JSON.stringify(hrefs, null, 2));

  // If there's an input for site URL on current page
  const inputs = page.locator("input");
  for (let i = 0; i < Math.min(await inputs.count(), 15); i++) {
    const el = inputs.nth(i);
    const vis = await el.isVisible().catch(() => false);
    const ph = await el.getAttribute("placeholder").catch(() => "");
    const aria = await el.getAttribute("aria-label").catch(() => "");
    if (vis) console.log("input", i, ph, aria);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/** Add secure.imagineqira.com to Bing Webmaster if missing and submit sitemap. */
import { chromium } from "/Users/bry/groking/autohustle-seo/node_modules/playwright/index.mjs";

const CDP = "http://127.0.0.1:9222";
const HOST = "https://secure.imagineqira.com/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || (await context.newPage());

  await page.goto("https://www.bing.com/webmasters/home", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await sleep(3000);
  let text = await page.locator("body").innerText();
  console.log("home:", text.slice(0, 500).replace(/\n/g, " | "));

  // Add site
  const adders = [
    page.getByRole("button", { name: /add a site|add site|add/i }),
    page.getByText(/Add a site/i),
    page.locator('a:has-text("Add a site")'),
  ];
  for (const a of adders) {
    if (await a.count()) {
      await a.first().click({ timeout: 3000 }).catch(() => {});
      await sleep(1000);
    }
  }

  // Fill URL
  const inputs = page.locator("input[type=text], input:not([type]), input[type=url]");
  const n = await inputs.count();
  console.log("inputs", n);
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.fill(HOST);
      console.log("filled", HOST);
      break;
    }
  }
  await sleep(500);
  const submit = page.getByRole("button", { name: /add|continue|submit|save|next/i });
  for (let i = 0; i < (await submit.count()); i++) {
    const b = submit.nth(i);
    if (await b.isVisible().catch(() => false)) {
      await b.click().catch(() => {});
      await sleep(2000);
      break;
    }
  }

  // Verification methods page — try HTML file if present, or meta
  text = await page.locator("body").innerText();
  console.log("after add:", page.url(), text.slice(0, 600).replace(/\n/g, " | "));

  // Navigate to sitemaps for the site
  await page.goto(
    `https://www.bing.com/webmasters/sitemaps?siteUrl=${encodeURIComponent(HOST)}`,
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  await sleep(3000);
  text = await page.locator("body").innerText();
  console.log("sitemaps page:", text.slice(0, 600).replace(/\n/g, " | "));

  if (/unauthorized|not authorized|add a site/i.test(text)) {
    // DNS / file verification needed
    console.log("NEED_VERIFY: Bing does not yet authorize this site for this Microsoft account.");
    // Try open verification
    await page.goto("https://www.bing.com/webmasters/home", {
      waitUntil: "domcontentloaded",
    });
    await sleep(2000);
    // capture any verification instructions
    console.log(
      "final:",
      (await page.locator("body").innerText()).slice(0, 1000).replace(/\n/g, " | "),
    );
    process.exit(2);
  }

  // Submit sitemap
  await page.getByText(/Submit sitemap|submit sitemap/i).first().click({ timeout: 5000 }).catch(() => {});
  await sleep(800);
  const sm = "https://secure.imagineqira.com/sitemap.xml";
  for (let i = 0; i < (await inputs.count()); i++) {
    const el = inputs.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.fill(sm);
      break;
    }
  }
  // re-query
  const inputs2 = page.locator("input[type=text], input:not([type])");
  for (let i = 0; i < (await inputs2.count()); i++) {
    const el = inputs2.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.fill(sm);
      console.log("sitemap filled");
      break;
    }
  }
  const sub = page.getByRole("button", { name: /submit|add/i });
  for (let i = 0; i < (await sub.count()); i++) {
    const b = sub.nth(i);
    if (await b.isVisible().catch(() => false)) {
      await b.click();
      console.log("submit clicked");
      break;
    }
  }
  await sleep(3000);
  console.log(
    "done page:",
    (await page.locator("body").innerText()).slice(0, 800).replace(/\n/g, " | "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

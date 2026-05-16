'use strict';

let browser = null;

async function getBrowser() {
  if (browser && browser.connected) return browser;

  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());

  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1280,800',
    ],
  });
  console.log('Puppeteer stealth browser startet');
  return browser;
}

async function newStealthPage(b) {
  const page = await b.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'no-NO,no;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  });
  return page;
}

// Hent HTML etter full JS-rendering
async function fetchPage(url, waitMs = 5000) {
  const b = await getBrowser();
  const page = await newStealthPage(b);
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
    await new Promise((r) => setTimeout(r, waitMs));
    return await page.content();
  } finally {
    await page.close();
  }
}

// Intercept JSON fra interne API-kall
async function interceptApiResponse(url, { interceptPatterns = [], waitMs = 8000 } = {}) {
  const b = await getBrowser();
  const page = await newStealthPage(b);
  const captured = [];

  try {
    page.on('response', async (response) => {
      const resUrl = response.url();
      const matches = interceptPatterns.some((p) =>
        typeof p === 'string' ? resUrl.includes(p) : p.test(resUrl)
      );
      if (!matches) return;
      try {
        const ct = response.headers()['content-type'] || '';
        if (!ct.includes('json')) return;
        const json = await response.json();
        captured.push({ url: resUrl, data: json });
        console.log('  Interceptet:', resUrl.substring(0, 100));
      } catch (e) {}
    });

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
    await new Promise((r) => setTimeout(r, waitMs));
    return captured;
  } finally {
    await page.close();
  }
}

// Hent og logg ALLE JSON-kall siden gjør – for debugging
async function debugAllRequests(url, waitMs = 8000) {
  const b = await getBrowser();
  const page = await newStealthPage(b);
  const allJson = [];

  try {
    page.on('response', async (response) => {
      const resUrl = response.url();
      try {
        const ct = response.headers()['content-type'] || '';
        if (!ct.includes('json')) return;
        const json = await response.json();
        allJson.push({ url: resUrl, keys: Object.keys(json).slice(0, 5) });
      } catch (e) {}
    });

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
    await new Promise((r) => setTimeout(r, waitMs));
    console.log(`DEBUG ${url.substring(0,60)}: ${allJson.length} JSON-kall:`);
    allJson.forEach((r) => console.log('  ', r.url.substring(0, 80), r.keys.join(',')));
    return allJson;
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browser) { await browser.close(); browser = null; }
}

module.exports = { getBrowser, fetchPage, interceptApiResponse, debugAllRequests, closeBrowser };

'use strict';

let browser = null;

async function getBrowser() {
  if (browser && browser.connected) return browser;
  const puppeteer = require('puppeteer');
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
      '--disable-blink-features=AutomationControlled',
    ],
  });
  console.log('Puppeteer browser startet');
  return browser;
}

// Hent HTML etter full JS-rendering
async function fetchPage(url, waitMs = 4000) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 40000 });
    await new Promise((r) => setTimeout(r, waitMs));
    return await page.content();
  } finally {
    await page.close();
  }
}

// Intercept JSON-svar fra API-kall siden gjør internt
async function interceptApiResponse(url, { interceptPatterns, waitMs = 6000 } = {}) {
  const b = await getBrowser();
  const page = await b.newPage();
  const captured = [];

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Lytt på alle nettverkssvar
    page.on('response', async (response) => {
      const resUrl = response.url();
      const matches = interceptPatterns.some((p) =>
        typeof p === 'string' ? resUrl.includes(p) : p.test(resUrl)
      );
      if (!matches) return;
      try {
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.includes('json')) return;
        const json = await response.json();
        captured.push({ url: resUrl, data: json });
        console.log('  Interceptet:', resUrl.substring(0, 80));
      } catch (e) { /* ikke JSON */ }
    });

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 40000 });
    await new Promise((r) => setTimeout(r, waitMs));
    return captured;
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browser) { await browser.close(); browser = null; }
}

module.exports = { getBrowser, fetchPage, interceptApiResponse, closeBrowser };

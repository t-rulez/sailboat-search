'use strict';

// Delt Puppeteer-instans for alle scrapere
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

async function fetchPage(url, waitFor = 2000) {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    // Skjul at vi er en bot
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'no-NO,no;q=0.9,en;q=0.8',
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Vent litt ekstra for JS-rendring
    if (waitFor) await new Promise((r) => setTimeout(r, waitFor));

    const html = await page.content();
    return html;
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

module.exports = { getBrowser, fetchPage, closeBrowser };

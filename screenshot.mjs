import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 800, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
await page.screenshot({ path: 'screenshot-home.png' });

// Type a name and show the create room flow
await page.type('input[placeholder="Your Name"]', 'Player1');
await page.screenshot({ path: 'screenshot-with-name.png' });

console.log('Screenshots saved!');
await browser.close();

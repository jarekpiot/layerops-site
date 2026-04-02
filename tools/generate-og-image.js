const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('Generating OG image...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });

  const filePath = 'file:///' + path.resolve('og-image.html').replace(/\\/g, '/');
  await page.goto(filePath, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'og-image.png', type: 'png' });

  await browser.close();
  console.log('✅ og-image.png created (1200x630)');
})();

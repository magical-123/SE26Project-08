const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Check if dev server is running, if not it will throw
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 10000 });
    
    const screenshotPath = path.join(__dirname, 'screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);
    
    await browser.close();
  } catch (error) {
    console.error('Error taking screenshot:', error.message);
    process.exit(1);
  }
})();

const { chromium } = require('playwright');

async function testStudent() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', resp => {
    if (resp.url().includes('/api/')) {
      console.log('API RESP:', resp.status(), resp.url());
    }
  });

  await page.goto('https://gia-su-app-psi.vercel.app/login', { waitUntil: 'networkidle' });

  await page.fill('input[placeholder*="teacher@example.com"]', 'student@example.com');
  await page.fill('input[type="password"]', 'Password@123!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);

  console.log('Local storage user:', await page.evaluate(() => localStorage.getItem('user')));
  console.log('Current URL:', page.url());

  await browser.close();
}

testStudent().catch(console.error);

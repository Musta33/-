import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    page.on('requestfailed', request => console.log('REQ FAIL:', request.url(), request.failure()?.errorText));

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    console.log("Done");
    await browser.close();
})();

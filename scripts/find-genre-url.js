const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  console.log("Navigating to home page...");
  await page.goto("https://doujin-lc.net/", { waitUntil: "domcontentloaded", timeout: 40000 });
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({ href: a.href, text: a.textContent?.trim() || "" }))
      .filter(l => l.href && l.href.includes("doujin-genre"));
  });
  
  console.log("Found genre links:");
  console.log(JSON.stringify(links, null, 2));
  
  await browser.close();
}

run().catch(console.error);

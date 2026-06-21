const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  const targetUrl = "https://doujin-lc.net/doujin-genre/%e0%b9%82%e0%b8%94%e0%b8%a8%e0%b8%b4%e0%b8%99%e0%b9%80%e0%b8%81%e0%b8%b2%e0%b8%ab%e0%b8%a5%e0%b8%b5-hmanhwa/";
  console.log("Navigating...");
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  const html = await page.evaluate(() => document.body.innerHTML.substring(0, 1000));
  
  console.log("PAGE TITLE:", title);
  console.log("BODY TEXT SAMPLE:", bodyText);
  console.log("HTML SAMPLE:", html);
  
  await browser.close();
}

run().catch(console.error);

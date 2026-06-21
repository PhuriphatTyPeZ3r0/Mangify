const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  const targetUrl = "https://doujin-lc.net/doujin-genre/โดจินเกาหลี-hmanhwa/";
  console.log("Navigating to:", targetUrl);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({ href: a.href, text: a.textContent?.trim() || "" }))
      .filter(l => l.href && l.href.includes("doujin-lc.net") && !l.href.includes("doujin-genre") && !l.href.includes("page"));
  });
  
  console.log("PAGE TITLE:", title);
  console.log("BODY SAMPLE:", bodyText);
  console.log("Filtered links matching count:", links.length);
  console.log("First 10 links:");
  console.log(JSON.stringify(links.slice(0, 10), null, 2));
  
  await browser.close();
}

run().catch(console.error);

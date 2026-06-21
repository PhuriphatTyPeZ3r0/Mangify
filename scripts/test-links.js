const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  const targetUrl = "https://doujin-lc.net/doujin-genre/%E0%B9%82%E0%B8%94%E0%B8%88%E0%B8%B4%E0%B8%99%E0%B9%80%E0%B8%81%E0%B8%B2%E0%B8%AB%E0%B8%A5%E0%B8%B5-hmanhwa/";
  console.log("Navigating to target genre url...");
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      href: a.href,
      text: a.textContent?.trim() || "",
      class: a.className
    }));
  });
  
  console.log("Total links found:", links.length);
  
  // Filter links containing /manga/ or typical detail links
  const filtered = links.filter(l => l.href && l.href.includes("doujin-lc.net") && !l.href.includes("/doujin-genre/") && !l.href.includes("/page/"));
  console.log("Filtered candidate links count:", filtered.length);
  console.log("Candidate links (first 50):");
  console.log(JSON.stringify(filtered.slice(0, 50), null, 2));
  
  await browser.close();
}

run().catch(console.error);

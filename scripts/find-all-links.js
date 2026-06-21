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
      .map(a => ({ href: a.href, text: a.textContent?.trim() || "" }));
  });
  
  console.log("Total links on home page:", links.length);
  
  // Filter for unique URLs
  const uniqueLinks = Array.from(new Set(links.map(l => l.href))).map(href => {
    return links.find(l => l.href === href);
  });
  
  console.log("Unique links count:", uniqueLinks.length);
  
  // Print links containing 'hmanhwa', 'manhwa', 'เกาหลี', 'doujin-genre'
  const filtered = uniqueLinks.filter(l => 
    l.href && (
      l.href.includes("hmanhwa") || 
      l.href.includes("manhwa") || 
      l.href.includes("เกาหลี") || 
      l.href.includes("doujin-genre") ||
      l.text.includes("เกาหลี") ||
      l.text.includes("Manhwa")
    )
  );
  
  console.log("Filtered links matching manhwa/เกาหลี/genre:");
  console.log(JSON.stringify(filtered, null, 2));
  
  await browser.close();
}

run().catch(console.error);

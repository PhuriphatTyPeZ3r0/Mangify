const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  const targetUrl = "https://doujin-lc.net/doujin-genre/โดจินเกาหลี-hmanhwa/";
  console.log("Navigating...");
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    return anchors.map(a => {
      const href = a.href;
      const startsWithDoujin = href.startsWith('https://doujin-lc.net/doujin/');
      const splitLength = href.split('/').filter(Boolean).length;
      return {
        href,
        text: a.textContent?.trim() || "",
        startsWithDoujin,
        splitLength
      };
    });
  });
  
  const doujinLinks = links.filter(l => l.href.includes("/doujin/"));
  console.log("Doujin Links count:", doujinLinks.length);
  console.log("First 10 doujin links analysis:");
  console.log(JSON.stringify(doujinLinks.slice(0, 10), null, 2));
  
  await browser.close();
}

run().catch(console.error);

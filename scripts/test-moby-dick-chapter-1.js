const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 800 });

  const detailUrl = "https://doujin-lc.net/doujin/moby-dick/";
  const chapterUrl = "https://doujin-lc.net/doujin/moby-dick/%e0%b8%8b%e0%b8%b5%e0%b8%8b%e0%b8%b1%e0%b9%88%e0%b8%99-1/%e0%b8%95%e0%b8%ad%e0%b8%99%e0%b8%97%e0%b8%b5%e0%b9%88-1/";

  console.log("Navigating to details...");
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  console.log("Clicking Chapter 1...");
  await page.evaluate((url) => {
    const links = Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-link a, .listing-chapters ul li a, a'));
    const target = links.find(a => a.href === url || a.href === decodeURIComponent(url) || decodeURIComponent(a.href) === decodeURIComponent(url));
    if (target) {
      target.click();
    } else {
      throw new Error("Link not found: " + url);
    }
  }, chapterUrl);

  console.log("Waiting for navigation...");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 40000 });
  
  const title = await page.title();
  console.log("Chapter Page Title:", title);

  const stats = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map(img => {
      const src = img.src || "";
      const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || "";
      return {
        src: src.substring(0, 100),
        dataSrc: dataSrc.substring(0, 100),
        parent: img.parentElement ? img.parentElement.className : ""
      };
    });
  });

  console.log("Found", stats.length, "images on Chapter 1 page:");
  console.log(JSON.stringify(stats, null, 2));

  await browser.close();
}

run().catch(console.error);

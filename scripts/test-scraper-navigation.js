const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 800 });

  const listUrl = "https://doujin-lc.net/doujin-genre/%E0%B9%82%E0%B8%94%E0%B8%88%E0%B8%B4%E0%B8%99%E0%B9%80%E0%B8%81%E0%B8%B2%E0%B8%AB%E0%B8%A5%E0%B8%B5-hmanhwa/";
  const mangaUrl = "https://doujin-lc.net/doujin/moby-dick/";
  
  console.log("1. Navigating to list page:", listUrl);
  await page.goto(listUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  console.log("List Page Title:", await page.title());

  console.log("2. Clicking manga link in list page...");
  await page.evaluate((url) => {
    const links = Array.from(document.querySelectorAll('a'));
    const target = links.find(a => a.href === url);
    if (target) {
      target.click();
    } else {
      throw new Error("Manga link not found: " + url);
    }
  }, mangaUrl);

  console.log("Waiting for navigation to details page...");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 40000 });
  console.log("Details Page URL:", page.url());
  console.log("Details Page Title:", await page.title());

  // Extract chapters from details page
  const chapters = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-link a, .listing-chapters ul li a'))
      .map(a => ({
        title: a.textContent?.trim() || "",
        url: a.href
      }));
  });
  console.log("Extracted chapters count:", chapters.length);
  const ch = chapters.reverse()[0]; // ตอนที่ 1
  console.log("Targeting chapter:", ch.title, "url:", ch.url);

  console.log("3. Clicking chapter link on details page...");
  await page.evaluate((url) => {
    const links = Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-link a, .listing-chapters ul li a, a'));
    const target = links.find(a => a.href === url);
    if (target) {
      target.click();
    } else {
      throw new Error("Chapter link not found in DOM");
    }
  }, ch.url);

  console.log("Waiting for navigation to chapter page...");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 40000 });
  console.log("Chapter Page URL:", page.url());
  console.log("Chapter Page Title:", await page.title());

  const info = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('.reading-content img'));
    return {
      imgsCount: imgs.length,
      firstImgs: imgs.map(img => ({
        src: img.src,
        dataSrc: img.getAttribute('data-src') || img.getAttribute('data-lazy-src')
      })).slice(0, 5),
      bodyText: document.body.innerText.substring(0, 500)
    };
  });

  console.log("INFO:", JSON.stringify(info, null, 2));

  await browser.close();
}

run().catch(console.error);

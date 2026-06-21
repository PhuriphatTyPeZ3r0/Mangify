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
  console.log("Navigating to Moby Dick details page...");
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  const title = await page.title();
  console.log("Title:", title);

  const chapters = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-link a, .listing-chapters ul li a, a'))
      .filter(a => a.href && a.href.includes('/doujin/moby-dick/'))
      .map(a => ({
        text: a.textContent.trim(),
        href: a.href
      }));
  });

  console.log("Chapters found:", chapters.length);
  console.log("First 5 chapters:", JSON.stringify(chapters.slice(0, 5), null, 2));
  console.log("Last 5 chapters:", JSON.stringify(chapters.slice(-5), null, 2));

  await browser.close();
}

run().catch(console.error);

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
  console.log("Navigating to details page:", detailUrl);
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  // Extract chapters exactly like the scraper does
  const chapters = await page.evaluate((url) => {
    return Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-link a, .listing-chapters ul li a'))
      .map(a => ({
        id: decodeURIComponent(a.href.split('/').filter(Boolean).pop()),
        title: a.textContent?.trim() || "",
        url: a.href
      }));
  }, detailUrl);

  console.log("Extracted chapters count:", chapters.length);
  if (chapters.length === 0) {
    console.log("No chapters extracted!");
    await browser.close();
    return;
  }

  // Reverse them like the scraper does
  const chaptersToSync = chapters.reverse();
  const ch = chaptersToSync[0]; // ตอนที่ 1
  console.log("Targeting chapter:", ch.title, "url:", ch.url);

  console.log("Simulating click on chapter...");
  await page.evaluate((url) => {
    const links = Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-link a, .listing-chapters ul li a, a'));
    const target = links.find(a => a.href === url);
    if (target) {
      target.click();
    } else {
      throw new Error("Link not found: " + url);
    }
  }, ch.url);

  console.log("Waiting for navigation...");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("Navigated! Current URL:", page.url());
  console.log("Page Title:", await page.title());

  console.log("Waiting for selector...");
  await page.waitForSelector('.page-break img, .reading-content img, #readerarea img, img', { timeout: 15000 }).catch(err => {
    console.log("waitForSelector timed out/failed:", err.message);
  });

  console.log("Evaluating pageImages...");
  const pageImages = await page.evaluate(() => {
    const selectors = ['.page-break img', '.reading-content img', '#readerarea img', '.v_content img'];
    let found = [];
    let usedSelector = "";
    for (const sel of selectors) {
      const imgs = Array.from(document.querySelectorAll(sel))
        .map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src'))
        .filter(Boolean);
      if (imgs.length > 0) { 
        found = imgs; 
        usedSelector = sel;
        break; 
      }
    }
    
    let fallbackUsed = false;
    if (found.length === 0) {
      fallbackUsed = true;
      found = Array.from(document.querySelectorAll('img'))
        .map(img => img.src || img.getAttribute('data-src'))
        .filter(src => src && (src.includes('wp-content/uploads') || src.includes('manga')));
    }
    
    return {
      count: found.length,
      usedSelector,
      fallbackUsed,
      sample: found.slice(0, 5),
      allImgsInDOM: Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        dataSrc: img.getAttribute('data-src')
      })).slice(0, 10)
    };
  });

  console.log("Evaluation result:", JSON.stringify(pageImages, null, 2));

  await browser.close();
}

run().catch(console.error);

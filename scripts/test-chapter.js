const puppeteer = require("puppeteer");

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 800 });

  const detailUrl = "https://doujin-lc.net/doujin/you-wont-get-me-twice/";
  const chapterUrl = "https://doujin-lc.net/doujin/you-wont-get-me-twice/%e0%b8%8b%e0%b8%b5%e0%b8%8b%e0%b8%b1%e0%b9%88%e0%b8%99-1/%e0%b8%95%e0%b8%ad%e0%b8%99%e0%b8%97%e0%b8%b5%e0%b9%88-26/";

  console.log("Navigating to manga details page:", detailUrl);
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  const detailTitle = await page.title();
  console.log("Detail Page Title:", detailTitle);

  console.log("Simulating click on chapter link...");
  await page.evaluate((url) => {
    const links = Array.from(document.querySelectorAll('a'));
    const target = links.find(a => a.href === url);
    if (target) {
      target.click();
    } else {
      throw new Error("Link not found: " + url);
    }
  }, chapterUrl);

  console.log("Waiting for navigation...");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 40000 });
  
  const chapterTitle = await page.title();
  console.log("Chapter Page Title:", chapterTitle);

  const imagesCount = await page.evaluate(() => {
    return document.querySelectorAll('img').length;
  });
  console.log("Total images in DOM on chapter page:", imagesCount);

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log("Body text sample:\n", bodyText);

  // Print all image src to check selectors
  const imgList = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      dataSrc: img.getAttribute('data-src'),
      lazySrc: img.getAttribute('data-lazy-src'),
      parentClass: img.parentElement?.className
    })).slice(0, 20);
  });
  console.log("First 20 images:", JSON.stringify(imgList, null, 2));

  await browser.close();
}

run().catch(console.error);

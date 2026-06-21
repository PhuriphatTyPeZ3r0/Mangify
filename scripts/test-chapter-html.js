const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 800 });

  const detailUrl = "https://doujin-lc.net/doujin/you-wont-get-me-twice/";
  const chapterUrl = "https://doujin-lc.net/doujin/you-wont-get-me-twice/%e0%b8%8b%e0%b8%b5%e0%b8%8b%e0%b8%b1%e0%b9%88%e0%b8%99-1/%e0%b8%95%e0%b8%ad%e0%b8%99%e0%b8%97%e0%b8%b5%e0%b9%88-26/";

  console.log("Navigating to detail...");
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  console.log("Clicking chapter link...");
  await page.evaluate((url) => {
    const links = Array.from(document.querySelectorAll('a'));
    const target = links.find(a => a.href === url);
    if (target) target.click();
    else throw new Error("Link not found: " + url);
  }, chapterUrl);

  console.log("Waiting for navigation...");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 40000 });
  
  console.log("Checking structure...");
  const info = await page.evaluate(() => {
    const selectors = [
      '.reading-content',
      '.page-break',
      '#readerarea',
      '.wp-manga-chapter-container',
      '.entry-content',
      '.main-col',
      '.cha-page',
      '.chap-imgs'
    ];
    
    const results = {};
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      results[sel] = el ? {
        exists: true,
        id: el.id,
        className: el.className,
        innerHTMLTrimmed: el.innerHTML.trim().substring(0, 500),
        childCount: el.children.length
      } : { exists: false };
    });

    // Let's also check if there is an iframe
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
      src: f.src,
      id: f.id,
      className: f.className
    }));

    // Find select inputs
    const selects = Array.from(document.querySelectorAll('select')).map(s => ({
      id: s.id,
      className: s.className,
      options: Array.from(s.options).map(o => o.text).slice(0, 5)
    }));

    return {
      results,
      iframes,
      selects,
      bodyHtml: document.body.innerHTML.substring(0, 1000)
    };
  });

  console.log("RESULTS BY SELECTOR:", JSON.stringify(info.results, null, 2));
  console.log("IFRAMES:", JSON.stringify(info.iframes, null, 2));
  console.log("SELECTS:", JSON.stringify(info.selects, null, 2));
  
  await browser.close();
}

run().catch(console.error);

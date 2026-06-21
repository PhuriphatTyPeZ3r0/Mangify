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

  const url = "https://doujin-lc.net/doujin/moby-dick/";
  console.log("Navigating to details page:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
  
  console.log("Details Page Title:", await page.title());

  const info = await page.evaluate(() => {
    // Let's print all img tags with their src and attributes
    const allImgs = Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      dataSrc: img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-lazyloaded'),
      className: img.className,
      parentId: img.parentElement?.id,
      parentClass: img.parentElement?.className
    }));

    // Check specific selectors
    const summaryImg = document.querySelector('.summary_image img');
    const tabThumb = document.querySelector('.tab-thumb img');

    return {
      summaryImgExists: !!summaryImg,
      summaryImgHtml: summaryImg ? summaryImg.outerHTML : null,
      tabThumbExists: !!tabThumb,
      tabThumbHtml: tabThumb ? tabThumb.outerHTML : null,
      allImgs: allImgs.slice(0, 30) // print first 30 images to inspect
    };
  });

  console.log("INFO:", JSON.stringify(info, null, 2));

  await browser.close();
}

run().catch(console.error);

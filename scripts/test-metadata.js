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

  const data = await page.evaluate(() => {
    // Let's dump all text or HTML of the post-content table or elements
    const postContent = document.querySelector('.post-content');
    const items = Array.from(document.querySelectorAll('.post-content_item, .post-content tr')).map(item => ({
      text: item.innerText.trim(),
      html: item.outerHTML.trim().substring(0, 300)
    }));

    return {
      postContentExists: !!postContent,
      postContentHtml: postContent ? postContent.innerHTML.trim().substring(0, 1000) : null,
      items
    };
  });

  console.log("METADATA ANALYSIS:", JSON.stringify(data, null, 2));

  await browser.close();
}

run().catch(console.error);

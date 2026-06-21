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
  
  console.log("Simulating click on chapter link...");
  await page.evaluate((url) => {
    const links = Array.from(document.querySelectorAll('a'));
    const target = links.find(a => a.href === url);
    if (target) target.click();
    else throw new Error("Link not found: " + url);
  }, chapterUrl);

  console.log("Waiting for navigation...");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 40000 });
  
  console.log("Analyzing image containers...");
  const analysis = await page.evaluate(() => {
    const allImgs = Array.from(document.querySelectorAll('img'));
    
    // Group images by their ancestors to find containers with many images (typical of manga reader)
    const containerMap = new Map();
    allImgs.forEach(img => {
      let parent = img.parentElement;
      while (parent && parent.tagName !== 'BODY') {
        const idStr = parent.id ? '#' + parent.id : '';
        const classStr = parent.className ? '.' + parent.className.trim().split(/\s+/).join('.') : '';
        const selector = `${parent.tagName.toLowerCase()}${idStr}${classStr}`;
        
        containerMap.set(selector, (containerMap.get(selector) || 0) + 1);
        parent = parent.parentElement;
      }
    });

    // Find containers containing more than 5 images
    const activeContainers = Array.from(containerMap.entries())
      .filter(([selector, count]) => count > 5)
      .sort((a, b) => b[1] - a[1]);

    // Inspect some specific manga-like images
    const mangaImgs = allImgs
      .map(img => {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || "";
        return {
          src,
          id: img.id,
          class: img.className,
          parent: img.parentElement ? `${img.parentElement.tagName.toLowerCase()}.${img.parentElement.className}` : ""
        };
      })
      .filter(img => img.src.includes('wp-content/uploads') && !img.src.includes('huayhit') && !img.src.includes('kingdom66') && !img.src.includes('banner') && !img.src.includes('sbobet'));

    return {
      totalImages: allImgs.length,
      activeContainers,
      mangaImgsSample: mangaImgs.slice(0, 15)
    };
  });

  console.log("TOTAL IMAGES:", analysis.totalImages);
  console.log("CONTAINERS WITH > 5 IMAGES:", JSON.stringify(analysis.activeContainers, null, 2));
  console.log("MANGA-LIKE IMAGES FOUND (First 15):", JSON.stringify(analysis.mangaImgsSample, null, 2));

  await browser.close();
}

run().catch(console.error);

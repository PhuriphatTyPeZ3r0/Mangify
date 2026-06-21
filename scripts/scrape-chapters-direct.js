const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Read and parse .env.local
const envPath = path.join(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local file not found");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      envVars[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  }
});

const cleanEnvVar = (val) => {
  if (!val) return "";
  return val.replace(/^['"]|['"]$/g, "").trim();
};

const supabaseUrl = cleanEnvVar(envVars["NEXT_PUBLIC_SUPABASE_URL"]);
const serviceRoleKey = cleanEnvVar(envVars["SUPABASE_SERVICE_ROLE_KEY"]);

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const targetMangaIds = ["moby-dick", "you-wont-get-me-twice"];

function getStandardizedChapterId(mangaId, chapterUrlOrSegment, title) {
  const decoded = decodeURIComponent(chapterUrlOrSegment);
  let segment = decoded;
  if (segment.includes("/")) {
    segment = segment.split('/').filter(Boolean).pop();
  }
  
  let numStr = null;
  const patterns = [
    /[-_]ep[-_](\d+[\.\-]?\d*)/i,
    /[-_]ch[-_](\d+[\.\-]?\d*)/i,
    /[-_]ตอนที่[-_](\d+[\.\-]?\d*)/i,
    /[-_]ch(\d+)/i,
    /[-_](\d+[\.\-]?\d*)$/
  ];

  for (const pat of patterns) {
    const match = segment.match(pat);
    if (match) {
      numStr = match[1].replace("-", ".");
      break;
    }
  }

  if (!numStr && title) {
    const titleMatch = title.match(/(\d+[\.\-]?\d*)/);
    if (titleMatch) {
      numStr = titleMatch[1].replace("-", ".");
    }
  }

  if (!numStr) {
    let suffix = segment;
    if (suffix.startsWith(mangaId)) {
      suffix = suffix.substring(mangaId.length);
    }
    suffix = suffix.replace(/^[-_]+/, "");
    return `${mangaId}-ch-${suffix.toLowerCase()}`;
  }

  return `${mangaId}-ch-${numStr}`;
}

async function scrapeChapters() {
  console.log("🚀 Launching Puppeteer browser with Stealth plugin...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 800 });

  for (const mangaId of targetMangaIds) {
    console.log(`\n==================================================`);
    console.log(`📖 Processing Manga: ${mangaId}`);
    console.log(`==================================================`);

    const detailUrl = `https://doujin-lc.net/doujin/${mangaId}/`;
    console.log(`🔗 Navigating to details page: ${detailUrl}`);
    
    try {
      await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      const mainTitle = await page.title();
      console.log(`   Page Title: "${mainTitle}"`);

      if (mainTitle.includes("Attention Required!") || mainTitle.includes("Blocked")) {
        console.error("❌ Blocked by Cloudflare on detail page! Skipping this manga.");
        continue;
      }

      // Extract chapters list
      const chaptersList = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-link a, .listing-chapters ul li a'));
        return anchors.map(a => ({
          href: a.href,
          title: a.textContent?.trim() || ""
        })).filter(ch => ch.href);
      });

      console.log(`   Found ${chaptersList.length} chapters.`);
      if (chaptersList.length === 0) {
        console.warn("   ⚠️ No chapters found on detail page. Skipping.");
        continue;
      }

      // Reversing to process Chapter 1 first
      const chaptersToSync = chaptersList.reverse();

      // Get existing chapters in database
      const { data: dbChapters, error: dbError } = await supabaseAdmin
        .from("chapters")
        .select("id")
        .eq("manga_id", mangaId);

      if (dbError) {
        console.error("   ❌ Failed to fetch existing chapters from DB:", dbError.message);
        continue;
      }

      const existingChapterIds = new Set(dbChapters.map(c => c.id));
      console.log(`   Already synced: ${existingChapterIds.size} chapters.`);

      // Filter to get only unsynced chapters
      const missingChapters = chaptersToSync.filter(ch => {
        // Extract segment
        const segment = decodeURIComponent(ch.href.split('/').filter(Boolean).pop());
        const chId = getStandardizedChapterId(mangaId, segment, ch.title);
        return !existingChapterIds.has(chId);
      });

      console.log(`   Chapters to sync: ${missingChapters.length}`);

      let count = 0;
      for (const ch of missingChapters) {
        count++;
        const segment = decodeURIComponent(ch.href.split('/').filter(Boolean).pop());
        const chapterId = getStandardizedChapterId(mangaId, segment, ch.title);

        console.log(`\n   [${count}/${missingChapters.length}] 📑 Syncing: "${ch.title}" (${chapterId})`);
        console.log(`   🔗 URL: ${ch.href}`);

        let cleanTitle = ch.title;
        let releaseDate = null;
        const dateRegex = /(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+\d+,\s+\d+/i;
        const dateMatch = ch.title.match(dateRegex);
        if (dateMatch) {
          cleanTitle = ch.title.replace(dateMatch[0], "").trim();
          releaseDate = dateMatch[0];
        }

        // Clean update suffixes
        const cleanPatterns = [
          /\s*-\s*อัพเดท\s*$/gi,
          /\s*-\s*อัปเดต\s*$/gi,
          /\s*-\s*อัพเดต\s*$/gi,
          /\s*-\s*อัปเดท\s*$/gi,
          /\s+อัพเดท\s*$/gi,
          /\s+อัปเดต\s*$/gi,
          /\s+อัพเดต\s*$/gi,
          /\s+อัปเดท\s*$/gi
        ];
        for (const pat of cleanPatterns) {
          cleanTitle = cleanTitle.replace(pat, "").trim();
        }

        // Open a new tab for this chapter to ensure clean session
        const chPage = await browser.newPage();
        await chPage.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        await chPage.setViewport({ width: 1280, height: 800 });

        try {
          await chPage.goto(ch.href, { waitUntil: "domcontentloaded", timeout: 45000 });
          await chPage.waitForSelector('.page-break img, .reading-content img, #readerarea img, .v_content img', { timeout: 15000 }).catch(() => {});
          
          // Wait 1.5 seconds for images to load
          await new Promise(r => setTimeout(r, 1500));

          const pageTitle = await chPage.title();
          if (pageTitle.includes("Attention Required!")) {
            console.error("      ❌ Cloudflare JS challenge encountered on this chapter page!");
            continue;
          }

          const pageImages = await chPage.evaluate(() => {
            const selectors = ['.page-break img', '.reading-content img', '#readerarea img', '.v_content img'];
            let found = [];
            for (const sel of selectors) {
              const imgs = Array.from(document.querySelectorAll(sel))
                .map(img => {
                  const src = img.src || "";
                  const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || "";
                  if (src.startsWith('data:') && dataSrc) {
                    return dataSrc;
                  }
                  return src || dataSrc;
                })
                .filter(src => src && !src.startsWith('data:'));
              if (imgs.length > 0) { found = imgs; break; }
            }
            if (found.length === 0) {
              found = Array.from(document.querySelectorAll('img'))
                .map(img => {
                  const src = img.src || "";
                  const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || "";
                  if (src.startsWith('data:') && dataSrc) {
                    return dataSrc;
                  }
                  return src || dataSrc;
                })
                .filter(src => src && (src.includes('wp-content/uploads') || src.includes('manga')) && !src.startsWith('data:'));
            }
            return found;
          });

          if (pageImages.length > 0) {
            console.log(`      ✅ Found ${pageImages.length} pages.`);
            
            // Sync to Supabase immediately
            const { error: upsertError } = await supabaseAdmin
              .from("chapters")
              .upsert({
                id: chapterId,
                manga_id: mangaId,
                title: cleanTitle,
                release_date: releaseDate,
                pages: pageImages,
                created_at: new Date().toISOString()
              });

            if (upsertError) {
              console.error(`      ❌ DB Error saving chapter:`, upsertError.message);
            } else {
              console.log(`      💾 Saved to DB successfully.`);
            }
          } else {
            console.warn(`      ⚠️ Warning: No image pages found.`);
          }

        } catch (chErr) {
          console.error(`      ❌ Error scraping chapter page:`, chErr.message);
        } finally {
          await chPage.close();
        }

        // Delay between chapters
        const delay = Math.floor(Math.random() * 2000) + 1500;
        console.log(`   Waiting ${delay}ms before next chapter...`);
        await new Promise(r => setTimeout(r, delay));
      }

    } catch (mangaErr) {
      console.error(`💥 Error scraping manga details for ${mangaId}:`, mangaErr.message);
    }
  }

  await browser.close();
  console.log("\n🏁 Done scraping chapters!");
}

scrapeChapters().catch(console.error);

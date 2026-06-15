const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

// --- Config & Auth ---
const envPath = path.join(__dirname, "../.env.local");
let envVars = process.env; // Default to process.env for CI

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        envVars[parts[0].trim()] = parts.slice(1).join("=").trim();
      }
    }
  });
}

const cleanEnvVar = (val) => {
  if (!val) return "";
  // Strip surrounding quotes (double or single) and trim whitespace/newlines
  return val.replace(/^['"]|['"]$/g, "").trim();
};

let supabaseUrl = cleanEnvVar(envVars["NEXT_PUBLIC_SUPABASE_URL"]);
const serviceRoleKey = cleanEnvVar(envVars["SUPABASE_SERVICE_ROLE_KEY"]);
const resendApiKey = cleanEnvVar(envVars["RESEND_API_KEY"]);

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Error: Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

// Auto-prepend https:// if protocol is missing
if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
  console.log(`ℹ️ Info: NEXT_PUBLIC_SUPABASE_URL does not start with http/https. Auto-prepending https://`);
  supabaseUrl = "https://" + supabaseUrl;
}

// Safe diagnostic log to verify URL format without leaking sensitive project IDs
const safeUrlPrefix = supabaseUrl.substring(0, 12);
console.log(`🔍 Diagnostic: Parsed NEXT_PUBLIC_SUPABASE_URL length = ${supabaseUrl.length}, prefix = "${safeUrlPrefix}..."`);

if (supabaseUrl.includes("placeholder") || supabaseUrl.includes("your-supabase")) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL is configured with a placeholder value. Please check your .env.local or GitHub secrets.");
  process.exit(1);
}

if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
  console.error(`❌ Error: NEXT_PUBLIC_SUPABASE_URL ("${supabaseUrl}") must be a valid HTTP or HTTPS URL. Please verify your config/secrets.`);
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const translationMap = {
  "Action": "ศิลปะการต่อสู้-แอคชั่น",
  "Adventure": "ผจญภัย",
  "Comedy": "ตลก",
  "Drama": "ดราม่า",
  "Fantasy": "แฟนตาซี",
  "Harem": "ฮาเร็ม",
  "Historical": "ย้อนยุค",
  "Martial Arts": "ศิลปะการต่อสู้-แอคชั่น",
  "Mystery": "ลึกลับ",
  "Psychological": "จิตวิทยา",
  "Romance": "โรแมนติก",
  "School Life": "ชีวิตในโรงเรียน",
  "Sci-fi": "ไซไฟ",
  "Seinen": "เซเน็น",
  "Shounen": "โชเน็น",
  "Slice of Life": "ชีวิตประจำวัน",
  "Supernatural": "เหนือธรรมชาติ",
  "Tragedy": "โศกนาฏกรรม",
  "ภัยภิบัติ": "ภัยพิบัติ",
};

const ignoredTags = new Set(["Webtoon", "Kakao"]);

function cleanGenres(genres) {
  if (!genres || !Array.isArray(genres)) return [];
  const mapped = genres
    .map(g => {
      const trimmed = g.trim();
      return translationMap[trimmed] || trimmed;
    })
    .filter(g => !ignoredTags.has(g) && g !== "");
  return Array.from(new Set(mapped));
}

// --- Stats Tracking ---
const stats = {
  mangasProcessed: 0,
  chaptersSynced: 0,
  errors: []
};

// --- Scraper Logic ---

const BASE_URL = "https://www.up-manga.com/";

async function sendNotification() {
  if (!resend) {
    console.log("📢 Notification skipped: RESEND_API_KEY not found.");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Mangify Bot <onboarding@resend.dev>',
      to: ['phuriphathem@gmail.com'],
      subject: `🚀 Mangify Ingestion Report: ${new Date().toLocaleDateString()}`,
      html: `
        <h2>Ingetion Summary</h2>
        <p><strong>Status:</strong> Completed</p>
        <p><strong>Mangas Processed:</strong> ${stats.mangasProcessed}</p>
        <p><strong>Chapters Synced:</strong> ${stats.chaptersSynced}</p>
        ${stats.errors.length > 0 ? `<h3>Errors:</h3><ul>${stats.errors.map(e => `<li>${e}</li>`).join('')}</ul>` : '<p>No errors occurred.</p>'}
        <hr/>
        <p>View your catalog at: <a href="https://mangify.vercel.app">mangify.vercel.app</a></p>
      `
    });

    if (error) console.error("❌ Email error:", error);
    else console.log("📧 Summary email sent to phuriphathem@gmail.com");
  } catch (err) {
    console.error("❌ Failed to send notification:", err.message);
  }
}

async function scrape() {
  console.log("🚀 Starting scraper...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for GitHub Actions
  });
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    console.log(`🔗 Navigating to ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: "networkidle2" });

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise(r => setTimeout(r, 2000));

    const mangaLinks = await page.evaluate(() => {
      const knownPopular = ["Reality Quest", "Magic Emperor", "Solo Leveling", "Nano Machine"];
      const links = Array.from(document.querySelectorAll('a'));
      
      const found = links.filter(a => {
        const text = a.textContent?.trim() || "";
        const href = a.href || "";
        const isMangaLink = href.startsWith('https://www.up-manga.com/') && 
                            href.split('/').filter(Boolean).length === 3 && 
                            !href.includes('/manga/') && 
                            !href.includes('/genres/') && 
                            !href.includes('/page/');

        return isMangaLink && (knownPopular.some(title => text.includes(title)) || a.querySelector('img'));
      }).map(a => a.href);
      
      return Array.from(new Set(found));
    });

    console.log(`📂 Found ${mangaLinks.length} potential manga links.`);
    
    for (const mangaUrl of mangaLinks) {
      console.log(`\n📖 Scraping Manga: ${mangaUrl}`);
      await new Promise(r => setTimeout(r, 1000));
      await page.goto(mangaUrl, { waitUntil: "networkidle2" });

      const mangaData = await page.evaluate((url) => {
        const h1Tags = Array.from(document.querySelectorAll('h1'));
        const titleTag = h1Tags.find(h => !h.textContent.includes("อ่านมังงะใหม่")) || h1Tags[0];
        const title = titleTag?.textContent?.trim() || "";
        const description = document.querySelector('.entry-content, .info-desc, .summary-content')?.textContent?.trim() || "";
        const cover = document.querySelector('.thumb img')?.src || document.querySelector('.summary_image img')?.src || "";
        
        // Extract from Info Table
        const infoRows = Array.from(document.querySelectorAll('.infotable tr'));
        let status = "Ongoing";
        let type = "Manhwa";
        let releaseYear = null;
        let author = "";
        let artist = "";
        let viewsCount = "0";

        infoRows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length === 2) {
            const label = cells[0].textContent.trim();
            const value = cells[1].textContent.trim();

            if (label.includes("สถานะ")) {
              status = value;
            } else if (label.includes("ประเภท")) {
              type = value;
            } else if (label.includes("ปีที่ปล่อย")) {
              const yearNum = parseInt(value, 10);
              if (!isNaN(yearNum)) releaseYear = yearNum;
            } else if (label.includes("ผู้แต่ง")) {
              author = value;
            } else if (label.includes("ผู้เขียน")) {
              artist = value;
            } else if (label.includes("Views")) {
              viewsCount = value;
            }
          }
        });

        // Fallback for author if not found in table
        if (!author) {
          author = document.querySelector('.spe span:nth-child(2)')?.textContent?.replace('Author:', '').trim() || "";
        }

        // Extract Alternative Title
        const originalTitle = document.querySelector('.seriestualt')?.textContent?.trim() || "";

        // Extract Followers Count
        const followersText = document.querySelector('.bmc')?.textContent || "";

        // Extract Genres
        const genres = Array.from(document.querySelectorAll('.seriestugenre a'))
          .map(a => a.textContent.trim())
          .filter(Boolean);
        
        const chapters = Array.from(document.querySelectorAll('.bxcl ul li a, .cl ul li a'))
          .map(a => ({
            id: a.href.split('/').filter(Boolean).pop(),
            title: a.textContent?.trim() || "",
            url: a.href
          }));

        const id = url.split('/').filter(Boolean).pop();
        return { id, title, description, cover, author, artist, status, type, releaseYear, viewsCount, originalTitle, genres, followersText, chapters };
      }, mangaUrl);

      if (!mangaData.id || !mangaData.title) {
        console.log("⚠️ Skipping: Could not parse title.");
        continue;
      }

      stats.mangasProcessed++;
      console.log(`✅ Extracted: ${mangaData.title} (${mangaData.chapters.length} chapters)`);

      // Popularity score calculation helper functions
      const parseViews = (viewsStr) => {
        if (!viewsStr) return 0;
        const cleanStr = viewsStr.trim().toLowerCase();
        if (cleanStr.includes('m')) {
          return parseFloat(cleanStr.replace('m', '')) * 1000000;
        }
        if (cleanStr.includes('k')) {
          return parseFloat(cleanStr.replace('k', '')) * 1000;
        }
        return parseInt(cleanStr.replace(/\D/g, ""), 10) || 0;
      };

      const parseFollowers = (followersStr) => {
        if (!followersStr) return 0;
        return parseInt(followersStr.replace(/\D/g, ""), 10) || 0;
      };

      const rawViews = parseViews(mangaData.viewsCount);
      const rawFollowers = parseFollowers(mangaData.followersText);
      const popularityScore = Math.round((rawViews * 0.7) + (rawFollowers * 0.3));

      console.log(`   └─ 📈 Stats: Views = ${rawViews.toLocaleString()} (${mangaData.viewsCount}), Followers = ${rawFollowers.toLocaleString()}, Popularity Score = ${popularityScore}`);

      await supabaseAdmin.from("manga").upsert({
        id: mangaData.id,
        title: mangaData.title,
        author: mangaData.author || null,
        cover: mangaData.cover || null,
        description: mangaData.description || null,
        genres: cleanGenres(mangaData.genres || []),
        is_original: true,
        popularity: popularityScore,
        original_title: mangaData.originalTitle || null,
        artist: mangaData.artist || null,
        status: mangaData.status || 'Ongoing',
        manga_type: mangaData.type || 'Manhwa',
        release_year: mangaData.releaseYear || null,
        views_count: mangaData.viewsCount || '0'
      });

      const chaptersToSync = mangaData.chapters.reverse();

      for (const ch of chaptersToSync) {
        const chapterId = `${mangaData.id}-${ch.id}`;
        
        const { data: existing } = await supabaseAdmin.from("chapters").select("id").eq("id", chapterId).single();
        if (existing) continue;

        console.log(`   └─ 📑 Syncing Chapter: ${ch.title}`);
        await new Promise(r => setTimeout(r, 500));
        await page.goto(ch.url, { waitUntil: "networkidle2" });

        const pageImages = await page.evaluate(() => {
          const selectors = ['#readerarea img', '.reader-area img', '.v_content img', '.reading-content img', '.page-break img'];
          let found = [];
          for (const sel of selectors) {
            const imgs = Array.from(document.querySelectorAll(sel)).map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src')).filter(Boolean);
            if (imgs.length > 0) { found = imgs; break; }
          }
          if (found.length === 0) {
            found = Array.from(document.querySelectorAll('img')).map(img => img.src || img.getAttribute('data-src')).filter(src => src && (src.includes('uploads') || src.includes('manga'))).filter(src => !src.includes('logo') && !src.includes('avatar'));
          }
          return found;
        });

        if (pageImages.length > 0) {
          await supabaseAdmin.from("chapters").upsert({
            id: chapterId,
            manga_id: mangaData.id,
            title: ch.title,
            pages: pageImages,
            created_at: new Date().toISOString()
          });
          stats.chaptersSynced++;
          console.log(`   ✅ Success: ${pageImages.length} pages.`);
        }
      }
    }
  } catch (err) {
    console.error("💥 Scraper crashed:", err);
    stats.errors.push(err.message);
  } finally {
    await browser.close();
    await sendNotification();
    console.log("\n🏁 Scraper finished.");
  }
}

scrape();

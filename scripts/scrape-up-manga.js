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

const supabaseUrl = cleanEnvVar(envVars["NEXT_PUBLIC_SUPABASE_URL"]);
const serviceRoleKey = cleanEnvVar(envVars["SUPABASE_SERVICE_ROLE_KEY"]);
const resendApiKey = cleanEnvVar(envVars["RESEND_API_KEY"]);

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Error: Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

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
        const author = document.querySelector('.spe span:nth-child(2)')?.textContent?.replace('Author:', '').trim() || "";
        
        const chapters = Array.from(document.querySelectorAll('.bxcl ul li a, .cl ul li a'))
          .map(a => ({
            id: a.href.split('/').filter(Boolean).pop(),
            title: a.textContent?.trim() || "",
            url: a.href
          }));

        const id = url.split('/').filter(Boolean).pop();
        return { id, title, description, cover, author, chapters };
      }, mangaUrl);

      if (!mangaData.id || !mangaData.title) {
        console.log("⚠️ Skipping: Could not parse title.");
        continue;
      }

      stats.mangasProcessed++;
      console.log(`✅ Extracted: ${mangaData.title} (${mangaData.chapters.length} chapters)`);

      await supabaseAdmin.from("manga").upsert({
        id: mangaData.id,
        title: mangaData.title,
        author: mangaData.author,
        cover: mangaData.cover,
        description: mangaData.description,
        is_original: true
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

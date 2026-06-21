const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
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
  supabaseUrl = "https://" + supabaseUrl;
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const { cleanGenres, cleanGenresAsync } = require("../src/lib/genreUtils");

function getStandardizedChapterId(mangaId, chapterUrlOrSegment, title) {
  const decoded = decodeURIComponent(chapterUrlOrSegment);
  
  // Extract the last path segment if it's a full URL
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

// --- Stats Tracking ---
const stats = {
  mangasProcessed: 0,
  chaptersSynced: 0,
  errors: []
};

// --- Scraper Logic ---
const TARGET_GENRE_URL = "https://doujin-lc.net/doujin-genre/%E0%B9%82%E0%B8%94%E0%B8%88%E0%B8%B4%E0%B8%99%E0%B9%80%E0%B8%81%E0%B8%B2%E0%B8%AB%E0%B8%A5%E0%B8%B5-hmanhwa/";

async function sendNotification() {
  if (!resend) {
    console.log("📢 Notification skipped: RESEND_API_KEY not found.");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Mangify Mature Bot <onboarding@resend.dev>',
      to: ['phuriphathem@gmail.com'],
      subject: `🔞 Mangify H-Manhwa Ingestion Report: ${new Date().toLocaleDateString()}`,
      html: `
        <h2>H-Manhwa Ingestion Summary</h2>
        <p><strong>Source:</strong> doujin-lc.net</p>
        <p><strong>Status:</strong> Completed</p>
        <p><strong>Mature Mangas Processed:</strong> ${stats.mangasProcessed}</p>
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
  console.log("🚀 Starting H-Manhwa scraper for doujin-lc.net...");

  // 1. Pre-fetch all existing chapters and mangas from Supabase first (before launching browser)
  console.log("🔗 Pre-fetching existing catalog from Supabase to prevent navigation delays...");
  let existingChapters = [];
  try {
    const { data, error } = await supabaseAdmin.from("chapters").select("id, manga_id");
    if (error) throw error;
    existingChapters = data || [];
  } catch (dbErr) {
    console.error("⚠️ Warning: Failed to pre-fetch chapters:", dbErr.message);
  }

  const existingChapterMap = new Map(); // mangaId -> Set of chapterIds
  for (const ch of existingChapters) {
    if (!existingChapterMap.has(ch.manga_id)) {
      existingChapterMap.set(ch.manga_id, new Set());
    }
    existingChapterMap.get(ch.manga_id).add(ch.id);
  }
  console.log(`   Cached ${existingChapters.length} existing chapters across ${existingChapterMap.size} titles.`);

  const allCompletedMangas = [];
  const allCompletedChapters = [];

  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    console.log(`🔗 Navigating to ${TARGET_GENRE_URL}...`);
    await page.goto(TARGET_GENRE_URL, { waitUntil: "domcontentloaded", timeout: 35000 });
    
    const title = await page.title();
    console.log(`🔍 Page Title: "${title}"`);

    // Find links immediately before any CF redirects/challenges activate
    const mangaLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const found = anchors
        .map(a => a.href)
        .filter(href => href && href.startsWith('https://doujin-lc.net/doujin/') && href.split('/').filter(Boolean).length === 4);
      return Array.from(new Set(found));
    });

    const totalAnchors = await page.evaluate(() => document.querySelectorAll('a').length);
    console.log(`🔍 Total anchors in page: ${totalAnchors}`);
    console.log(`📂 Found ${mangaLinks.length} H-Manhwa manga links.`);
    
    // Limit to first 2 mangas for verification/testing
    const testMangaLinks = mangaLinks.slice(0, 2);
    
    for (const mangaUrl of testMangaLinks) {
      try {
        console.log(`\n📖 Scraping H-Manhwa Manga Details: ${mangaUrl}`);
        
        const mangaId = decodeURIComponent(mangaUrl.split('/').filter(Boolean).pop());
        const existingSet = existingChapterMap.get(mangaId) || new Set();

        // 2. Click manga link to simulate human behavior immediately (without DB network delay)
        console.log(`   Current page before click - Title: "${await page.title()}" | URL: ${page.url()}`);
        await page.evaluate((url) => {
          const links = Array.from(document.querySelectorAll('a'));
          const decodedTarget = decodeURIComponent(url).replace(/\/$/, "");
          const target = links.find(a => {
            if (!a.href) return false;
            const decodedHref = decodeURIComponent(a.href).replace(/\/$/, "");
            return decodedHref === decodedTarget;
          });
          if (target) target.click();
          else throw new Error("Link not found in DOM: " + url + " | Decoded target: " + decodedTarget + " | Available links count: " + links.length);
        }, mangaUrl);

        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 35000 });
        await page.waitForSelector('.post-title, h1, .chapter-link, .wp-manga-chapter', { timeout: 15000 }).catch(() => {});

        const mangaData = await page.evaluate((url) => {
          const h1 = document.querySelector('h1')?.textContent?.trim() || "";
          const title = h1 || document.querySelector('.post-title')?.textContent?.trim() || "";
          const description = document.querySelector('.summary__content, .description-summary, .entry-content')?.textContent?.trim() || "";
          
          let cover = "";
          const coverImg = document.querySelector('.summary_image img, .tab-thumb img');
          if (coverImg) {
            const src = coverImg.src || "";
            const dataSrc = coverImg.getAttribute('data-src') || coverImg.getAttribute('data-lazy-src') || "";
            cover = (src.startsWith('data:') && dataSrc) ? dataSrc : (src || dataSrc);
          }

          // Metadata extraction for Madara theme
          let author = "";
          let artist = "";
          let status = "Ongoing";
          let type = "Manhwa";
          let releaseYear = null;
          let viewsCount = "0";

          const authorEl = document.querySelector('.author-content a, .spe span:nth-child(2)');
          if (authorEl) author = authorEl.textContent.trim();
          
          const artistEl = document.querySelector('.artist-content a, .spe span:nth-child(3)');
          if (artistEl) artist = artistEl.textContent.trim();

          const statusEl = document.querySelector('.status-content, .post-status');
          if (statusEl) {
            const statusText = statusEl.textContent.trim().toLowerCase();
            if (statusText.includes("จบ") || statusText.includes("completed")) {
              status = "Completed";
            }
          }

          const typeEl = document.querySelector('.type-content, .post-content tr:nth-child(5) td:nth-child(2)');
          if (typeEl) type = typeEl.textContent.trim();

          const yearEl = document.querySelector('.release-year, .post-content tr:nth-child(6) td:nth-child(2)');
          if (yearEl) {
            const parsedY = parseInt(yearEl.textContent.trim(), 10);
            if (!isNaN(parsedY)) releaseYear = parsedY;
          }

          const viewsEl = document.querySelector('.post-content tr:nth-child(7) td:nth-child(2)');
          if (viewsEl) viewsCount = viewsEl.textContent.trim();

          // Extract Alternative/Original Title
          const originalTitle = document.querySelector('.post-content_item:nth-child(2) .summary-content')?.textContent?.trim() || "";

          // Extract Genres
          const genres = Array.from(document.querySelectorAll('.genres-content a, .seriestugenre a'))
            .map(a => a.textContent.trim())
            .filter(Boolean);

          // Extract Chapters
          const chapters = Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-link a, .listing-chapters ul li a'))
            .map(a => ({
              id: decodeURIComponent(a.href.split('/').filter(Boolean).pop()),
              title: a.textContent?.trim() || "",
              url: a.href
            }));

          const id = decodeURIComponent(url.split('/').filter(Boolean).pop());
          return { id, title, description, cover, author, artist, status, type, releaseYear, viewsCount, originalTitle, genres, chapters };
        }, mangaUrl);

        if (!mangaData.id || !mangaData.title) {
          console.log("⚠️ Skipping: Could not parse ID or Title.");
          continue;
        }

        // Add default genres
        if (!mangaData.genres.includes("H-Manhwa")) {
          mangaData.genres.push("H-Manhwa");
        }
        if (!mangaData.genres.includes("โดจินเกาหลี")) {
          mangaData.genres.push("โดจินเกาหลี");
        }

        stats.mangasProcessed++;
        console.log(`✅ Extracted H-Manhwa: ${mangaData.title} (${mangaData.chapters.length} chapters)`);

        const popularityScore = Math.round(Math.random() * 5000 + 1000); // Random base popularity

        // Filter out chapters we already have in our existingSet
        const chaptersToSync = mangaData.chapters.reverse().filter(ch => {
          const chapterId = getStandardizedChapterId(mangaData.id, ch.id, ch.title);
          return !existingSet.has(chapterId);
        });

        console.log(`   └─ 📑 Chapters to sync: ${chaptersToSync.length}`);

        const completedChapters = [];

        for (const ch of chaptersToSync) {
          const chapterId = getStandardizedChapterId(mangaData.id, ch.id, ch.title);
          
          console.log(`   └─ 📑 Syncing Chapter: ${ch.title}`);
          
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

          try {
            // Click chapter link to simulate human behavior
            await page.evaluate((url) => {
              const links = Array.from(document.querySelectorAll('.wp-manga-chapter a, .chapter-link a, .listing-chapters ul li a, a'));
              const decodedTargetUrl = decodeURIComponent(url);
              const target = links.find(a => {
                if (!a.href) return false;
                const decodedHref = decodeURIComponent(a.href);
                return a.href === url || decodedHref === decodedTargetUrl;
              });
              if (target) target.click();
              else throw new Error("Chapter link not found in DOM");
            }, ch.url);

            await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForSelector('.page-break img, .reading-content img, #readerarea img', { timeout: 15000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000)); // Small delay for scripts to execute

            console.log(`      Landed on: ${page.url()} | Title: ${await page.title()}`);

            const pageImages = await page.evaluate(() => {
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
              completedChapters.push({
                id: chapterId,
                manga_id: mangaData.id,
                title: cleanTitle,
                release_date: releaseDate,
                pages: pageImages,
                created_at: new Date().toISOString()
              });
              stats.chaptersSynced++;
              console.log(`   ✅ Extracted: ${pageImages.length} pages.`);
            } else {
              console.warn(`   ⚠️ Warning: No pages found for chapter: ${ch.title}`);
              stats.errors.push(`No pages found for chapter "${ch.title}" of manga "${mangaData.title}"`);
            }
          } catch (chErr) {
            console.error(`   ❌ Failed to scrape chapter ${ch.title}:`, chErr.message);
            stats.errors.push(`Chapter "${ch.title}" of manga "${mangaData.title}": ${chErr.message}`);
          } finally {
            // Return to details page
            console.log("   🔙 Returning to manga details page...");
            await page.goBack({ waitUntil: "domcontentloaded", timeout: 35000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        // Store to global in-memory lists (we will bulk write after browser closes to avoid Cloudflare detection)
        allCompletedMangas.push({
          id: mangaData.id,
          title: mangaData.title,
          author: mangaData.author || null,
          cover: mangaData.cover || null,
          description: mangaData.description || null,
          genres: await cleanGenresAsync(mangaData.genres || []),
          is_original: true,
          popularity: popularityScore,
          original_title: mangaData.originalTitle || null,
          artist: mangaData.artist || null,
          status: mangaData.status || 'Ongoing',
          manga_type: mangaData.type || 'Manhwa',
          release_year: mangaData.releaseYear || null,
          views_count: mangaData.viewsCount || '0',
          is_mature: true
        });

        if (completedChapters.length > 0) {
          allCompletedChapters.push(...completedChapters);
        }
        
      } catch (mangaErr) {
        console.error(`💥 Failed to scrape manga ${mangaUrl}:`, mangaErr.message);
        stats.errors.push(`Manga "${mangaUrl}": ${mangaErr.message}`);
      } finally {
        console.log("🔙 Returning to genre list page...");
        await page.goto(TARGET_GENRE_URL, { waitUntil: "domcontentloaded", timeout: 35000 }).catch(() => {});
        // Scroll to load lazy items again
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise(r => setTimeout(r, 4500));
      }
    }
  } catch (err) {
    console.error("💥 Scraper crashed:", err);
    stats.errors.push(err.message);
  } finally {
    console.log("🔌 Closing browser session...");
    await browser.close();
    
    // Save everything to Supabase now that browser is completely closed and inactive
    if (allCompletedMangas.length > 0) {
      console.log(`\n💾 Bulk saving ${allCompletedMangas.length} mangas and ${allCompletedChapters.length} chapters to Supabase...`);
      
      for (const manga of allCompletedMangas) {
        console.log(`   Saving manga metadata: ${manga.title}`);
        await supabaseAdmin.from("manga").upsert(manga);
      }
      
      if (allCompletedChapters.length > 0) {
        console.log(`   Saving all chapters in bulk...`);
        const { error: upsertError } = await supabaseAdmin.from("chapters").upsert(allCompletedChapters);
        if (upsertError) {
          console.error("❌ Error upserting chapters to Supabase:", upsertError.message);
          stats.errors.push(`Failed to save chapters in bulk: ${upsertError.message}`);
        } else {
          console.log(`💾 Bulk save completed successfully.`);
        }
      }
    }

    await sendNotification();
    console.log("\n🏁 H-Manhwa Scraper finished.");
  }
}

scrape();

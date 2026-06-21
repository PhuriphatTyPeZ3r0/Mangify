const { createClient } = require("@supabase/supabase-js");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
let envVars = {};

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

const supabaseUrl = cleanEnvVar(envVars["NEXT_PUBLIC_SUPABASE_URL"]);
const serviceRoleKey = cleanEnvVar(envVars["SUPABASE_SERVICE_ROLE_KEY"]);

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log("🔗 Connecting to Supabase...");
  const { data: mangas, error } = await supabaseAdmin
    .from("manga")
    .select("id, title, cover");

  if (error) {
    console.error("❌ Error fetching mangas:", error.message);
    return;
  }

  // Find mangas with base64 placeholder covers or empty covers
  const brokenMangas = mangas.filter(m => !m.cover || m.cover.startsWith("data:image"));
  console.log(`Found ${brokenMangas.length} mangas with broken or missing covers out of ${mangas.length} total.`);

  if (brokenMangas.length === 0) {
    console.log("✅ No broken covers found. Exiting.");
    return;
  }

  console.log("🚀 Launching stealth browser to repair covers...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  for (const manga of brokenMangas) {
    // Construct details URL
    // If it's a scraped doujin, URL is under /doujin/
    const targetUrl = `https://doujin-lc.net/doujin/${manga.id}/`;
    console.log(`\n📖 Scraping cover for: ${manga.title} (${manga.id})`);
    console.log(`🔗 Target URL: ${targetUrl}`);

    try {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
      const title = await page.title();
      
      if (title.includes("Page not found") || title.includes("404")) {
        console.warn(`   ⚠️ 404 Page not found for: ${manga.title}. Trying /manga/ prefix...`);
        const fallbackUrl = `https://doujin-lc.net/manga/${manga.id}/`;
        await page.goto(fallbackUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
      }

      const coverUrl = await page.evaluate(() => {
        const coverImg = document.querySelector('.summary_image img, .tab-thumb img');
        if (coverImg) {
          const src = coverImg.src || "";
          const dataSrc = coverImg.getAttribute('data-src') || coverImg.getAttribute('data-lazy-src') || "";
          if (src.startsWith('data:') && dataSrc) {
            return dataSrc;
          }
          return src || dataSrc;
        }
        return null;
      });

      if (coverUrl && !coverUrl.startsWith("data:")) {
        console.log(`   ✅ Found Cover URL: ${coverUrl}`);
        const { error: updateError } = await supabaseAdmin
          .from("manga")
          .update({ cover: coverUrl })
          .eq("id", manga.id);

        if (updateError) {
          console.error(`   ❌ Failed to update DB for ${manga.title}:`, updateError.message);
        } else {
          console.log(`   💾 DB updated successfully for ${manga.title}!`);
        }
      } else {
        console.warn(`   ⚠️ Warning: Could not find valid cover image on page (found: ${coverUrl})`);
      }
    } catch (err) {
      console.error(`   💥 Failed to scrape cover for ${manga.title}:`, err.message);
    }
  }

  await browser.close();
  console.log("\n🏁 Cover repair backfill complete!");
}

run().catch(console.error);

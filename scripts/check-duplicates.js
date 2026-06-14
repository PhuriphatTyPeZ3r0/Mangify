const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read and parse .env.local
const envPath = path.join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const [k, v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.trim();
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function checkDuplicates() {
  console.log("🔍 Checking for duplicates in 'manga' table...");
  const { data: mangas, error: mError } = await supabase.from('manga').select('id, title');
  if (mError) {
    console.error("Error fetching mangas:", mError.message);
  } else {
    const mangaTitles = mangas.map(m => m.title.toLowerCase());
    const duplicateTitles = mangaTitles.filter((item, index) => mangaTitles.indexOf(item) !== index);
    
    if (duplicateTitles.length > 0) {
      console.log(`❌ Found ${duplicateTitles.length} duplicate manga titles:`, [...new Set(duplicateTitles)]);
    } else {
      console.log("✅ No duplicate manga titles found.");
    }
  }

  console.log("\n🔍 Checking for duplicates in 'chapters' table...");
  // We check for duplicates based on manga_id + title combo
  const { data: chapters, error: cError } = await supabase.from('chapters').select('id, manga_id, title');
  
  if (cError) {
    console.error("Error fetching chapters:", cError.message);
  } else {
    const chapterCombos = chapters.map(c => `${c.manga_id}|${c.title.toLowerCase()}`);
    const duplicateChapters = chapterCombos.filter((item, index) => chapterCombos.indexOf(item) !== index);
    
    if (duplicateChapters.length > 0) {
      console.log(`❌ Found ${duplicateChapters.length} duplicate chapters (same manga + title):`);
      // Count duplicates per manga
      const counts = {};
      duplicateChapters.forEach(c => {
        const mangaId = c.split('|')[0];
        counts[mangaId] = (counts[mangaId] || 0) + 1;
      });
      console.log(counts);
    } else {
      console.log("✅ No duplicate chapters found.");
    }
  }
}

checkDuplicates();

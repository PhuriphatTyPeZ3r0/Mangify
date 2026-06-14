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

async function cleanChapters() {
  const MANGA_ID = 'reality-quest';
  console.log(`🧹 Cleaning up non-integer chapters for: ${MANGA_ID}...`);

  // 1. Fetch all chapters for this manga
  const { data: chapters, error: fetchError } = await supabase
    .from('chapters')
    .select('id, title')
    .eq('manga_id', MANGA_ID);

  if (fetchError) {
    console.error("Error fetching chapters:", fetchError.message);
    return;
  }

  // 2. Identify chapters with decimals in their title (e.g., "ตอนที่ 164.5")
  const decimalChapters = chapters.filter(ch => {
    // Regex matches numbers followed by a dot and another number (e.g., 164.5)
    return /\d+\.\d+/.test(ch.title);
  });

  if (decimalChapters.length === 0) {
    console.log("✅ No decimal chapters found.");
  } else {
    console.log(`🚫 Found ${decimalChapters.length} decimal chapters to delete.`);
    
    // 3. Delete them by IDs
    const idsToDelete = decimalChapters.map(ch => ch.id);
    const { error: deleteError } = await supabase
      .from('chapters')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error("❌ Error deleting chapters:", deleteError.message);
    } else {
      console.log(`✅ Successfully deleted ${idsToDelete.length} chapters.`);
    }
  }

  // 4. Verification
  const { count, error: countError } = await supabase
    .from('chapters')
    .select('*', { count: 'exact', head: true })
    .eq('manga_id', MANGA_ID);
  
  if (!countError) {
    console.log(`📊 Final chapter count for ${MANGA_ID}: ${count} ตอน`);
  }
}

cleanChapters();

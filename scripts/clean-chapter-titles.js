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

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Suffixes pattern
const cleanPatterns = [
  /\s*-\s*อัพเดท\s*$/gi,
  /\s*-\s*อัปเดต\s*$/gi,
  /\s*-\s*อัพเดต\s*$/gi,
  /\s*-\s*อัปเดท\s*$/gi,
  /\s+อัพเดท\s*$/gi,
  /\s+อัปเดต\s*$/gi,
  /\s+อัพเดต\s*$/gi,
  /\s+อัปเดท\s*$/gi,
  /\s*-\s*อัพเดท\s*-\s*อัพเดท\s*$/gi,
  /\s*-\s*อัพเดท\s*-\s*อัปเดต\s*$/gi,
];

function cleanTitle(title) {
  if (!title) return "";
  let clean = title.trim();
  for (const pat of cleanPatterns) {
    clean = clean.replace(pat, "").trim();
  }
  return clean;
}

async function run() {
  console.log("🔗 Fetching all chapters from Supabase...");
  
  // Fetch only chapters containing update keywords to bypass default limits
  const { data: chapters, error } = await supabaseAdmin
    .from("chapters")
    .select("id, title")
    .or("title.ilike.%อัพเดท%,title.ilike.%อัปเดต%,title.ilike.%อัพเดต%,title.ilike.%อัปเดท%");

  if (error) {
    console.error("❌ Error fetching chapters:", error.message);
    return;
  }

  console.log(`Found ${chapters.length} chapters total.`);
  
  const chaptersToUpdate = [];
  for (const ch of chapters) {
    const cleaned = cleanTitle(ch.title);
    if (cleaned !== ch.title) {
      chaptersToUpdate.push({
        id: ch.id,
        original: ch.title,
        cleaned: cleaned
      });
    }
  }

  console.log(`Need to update ${chaptersToUpdate.length} chapters.`);
  
  if (chaptersToUpdate.length === 0) {
    console.log("✅ No chapters with suffixes found. Everything is clean!");
    return;
  }

  console.log("Updating chapters in database...");
  for (const ch of chaptersToUpdate) {
    console.log(`   Updating: "${ch.original}" ➡️ "${ch.cleaned}"`);
    const { error: updateError } = await supabaseAdmin
      .from("chapters")
      .update({ title: ch.cleaned })
      .eq("id", ch.id);

    if (updateError) {
      console.error(`   ❌ Failed to update ${ch.id}:`, updateError.message);
    }
  }

  console.log("🏁 Database cleanup complete!");
}

run().catch(console.error);

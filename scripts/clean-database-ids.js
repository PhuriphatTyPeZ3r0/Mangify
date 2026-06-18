const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error(".env.local file not found");
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
const supabase = createClient(supabaseUrl, serviceRoleKey);

function extractNumber(str) {
  if (!str) return null;
  const match = str.match(/(\d+[\.\-]?\d*)/);
  if (match) {
    let val = match[1].replace("-", ".");
    return parseFloat(val);
  }
  return null;
}

function getNewId(mangaId, oldId, title) {
  const decoded = decodeURIComponent(oldId);
  let numStr = null;

  const patterns = [
    /[-_]ep[-_](\d+[\.\-]?\d*)/i,
    /[-_]ch[-_](\d+[\.\-]?\d*)/i,
    /[-_]ตอนที่[-_](\d+[\.\-]?\d*)/i,
    /[-_]ch(\d+)/i,
    /[-_](\d+[\.\-]?\d*)$/
  ];

  for (const pat of patterns) {
    const match = decoded.match(pat);
    if (match) {
      numStr = match[1].replace("-", ".");
      break;
    }
  }

  if (!numStr) {
    const titleMatch = title.match(/(\d+[\.\-]?\d*)/);
    if (titleMatch) {
      numStr = titleMatch[1].replace("-", ".");
    }
  }

  if (!numStr) {
    const suffix = decoded.replace(mangaId, "").replace(/^[-_]+/, "");
    return `${mangaId}-ch-${suffix.toLowerCase()}`;
  }

  return `${mangaId}-ch-${numStr}`;
}

async function migrate() {
  const dryRun = process.argv.includes("--execute") ? false : true;
  console.log(`=== ID Migration Starting (${dryRun ? "DRY RUN" : "LIVE EXECUTION"}) ===`);

  // 1. Fetch all chapters
  let chapters = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("chapters")
      .select("id, manga_id, title")
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    chapters = [...chapters, ...data];
    offset += limit;
  }
  console.log(`Fetched ${chapters.length} chapters.`);

  // 2. Map old IDs to new IDs and check for collisions
  const idMap = {};
  const reverseMap = {};
  const collisions = [];

  chapters.forEach(ch => {
    const newId = getNewId(ch.manga_id, ch.id, ch.title);
    idMap[ch.id] = newId;

    if (reverseMap[newId]) {
      collisions.push({
        newId,
        oldIds: [reverseMap[newId].id, ch.id],
        titles: [reverseMap[newId].title, ch.title]
      });
    } else {
      reverseMap[newId] = ch;
    }
  });

  if (collisions.length > 0) {
    console.error(`⚠️ Found ${collisions.length} primary key collisions!`);
    console.error(JSON.stringify(collisions.slice(0, 10), null, 2));
    if (!dryRun) {
      console.error("Migration aborted due to collisions.");
      process.exit(1);
    }
  } else {
    console.log("✅ No ID collisions detected.");
  }

  if (dryRun) {
    console.log("\nSample mappings:");
    const samples = chapters.slice(0, 10);
    samples.forEach(ch => {
      console.log(`  [OLD] ${ch.id} -> [NEW] ${idMap[ch.id]}`);
    });
    console.log("\nTo execute live migration, run this command with the --execute flag.");
    return;
  }

  // Live migration execution
  console.log("\nExecuting live migration...");

  // Batch updates for performance
  const batchSize = 100;
  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(chapters.length / batchSize)}...`);

    // 3. Update chapters in DB
    // Since we cannot update primary key directly in batch easily, we do them one by one in parallel promises
    const promises = batch.map(async (ch) => {
      const newId = idMap[ch.id];
      if (newId === ch.id) return; // No change needed

      // Update reading_progress first to prevent orphaned FK constraint checks (though we dropped the FK, we still update both)
      const { error: pErr } = await supabase
        .from("reading_progress")
        .update({ chapter_id: newId })
        .eq("chapter_id", ch.id);
      if (pErr) {
        console.error(`Failed to update reading progress for ${ch.id}:`, pErr.message);
      }

      // Insert new chapter row with new ID and delete the old one
      // Fetch full row content
      const { data: fullRow, error: fErr } = await supabase
        .from("chapters")
        .select("*")
        .eq("id", ch.id)
        .single();
      if (fErr) throw fErr;

      // Insert new row
      const { error: insErr } = await supabase
        .from("chapters")
        .insert({
          ...fullRow,
          id: newId
        });
      if (insErr) {
        console.error(`Failed to insert chapter ${newId}:`, insErr.message);
        return;
      }

      // Delete old row
      const { error: delErr } = await supabase
        .from("chapters")
        .delete()
        .eq("id", ch.id);
      if (delErr) {
        console.error(`Failed to delete old chapter ${ch.id}:`, delErr.message);
      }
    });

    await Promise.all(promises);
  }

  console.log("🎉 Migration completed successfully!");
}

migrate().catch(console.error);

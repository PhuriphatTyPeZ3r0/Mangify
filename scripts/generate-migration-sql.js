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

function getNewId(mangaId, oldId, title) {
  const decoded = decodeURIComponent(oldId);
  
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

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

function formatSqlArray(arr) {
  if (!arr || arr.length === 0) return "'{}'::text[]";
  return `ARRAY[${arr.map(item => escapeSql(item)).join(', ')}]::text[]`;
}

async function run() {
  console.log("Fetching chapters from database...");
  let chapters = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("chapters")
      .select("id, manga_id, title, pages, created_at, release_date")
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    chapters = [...chapters, ...data];
    offset += limit;
  }
  console.log(`Fetched ${chapters.length} chapters.`);

  // Group chapters by target ID
  const groups = {};
  chapters.forEach(ch => {
    const newId = getNewId(ch.manga_id, ch.id, ch.title);
    if (!groups[newId]) {
      groups[newId] = [];
    }
    groups[newId].push(ch);
  });

  const sqlStatements = [];
  sqlStatements.push("-- Mangify Chapter ID Standardization Migration");
  sqlStatements.push("BEGIN;");
  
  // Disable triggers to speed up and avoid foreign key issues during intermediate steps
  sqlStatements.push("ALTER TABLE public.reading_progress DISABLE TRIGGER ALL;");
  sqlStatements.push("ALTER TABLE public.chapters DISABLE TRIGGER ALL;");

  let renameCount = 0;
  let collisionCount = 0;

  for (const newId in groups) {
    const group = groups[newId];
    
    // Check if change is needed
    const needsMigration = group.some(ch => ch.id !== newId) || group.length > 1;
    if (!needsMigration) continue;

    // Find winner
    let winner = group.find(ch => ch.id === newId);
    
    if (group.length > 1) {
      collisionCount++;
      if (!winner) {
        winner = group.find(ch => ch.pages && ch.pages.length > 0) || group[0];
      }
      
      const losers = group.filter(ch => ch.id !== winner.id);
      
      // Merge pages
      let mergedPages = winner.pages;
      if (!mergedPages || mergedPages.length === 0) {
        const pageLoser = losers.find(ch => ch.pages && ch.pages.length > 0);
        if (pageLoser) {
          mergedPages = pageLoser.pages;
        }
      }

      sqlStatements.push(`\n-- Resolve collision for target ID: ${newId}`);

      // 1. Update reading progress for all losers to point to the target newId
      losers.forEach(loser => {
        sqlStatements.push(`UPDATE public.reading_progress SET chapter_id = ${escapeSql(newId)} WHERE chapter_id = ${escapeSql(loser.id)};`);
      });

      const winnerExists = winner.id === newId;

      // 2. If winner wasn't already on the target ID
      if (!winnerExists) {
        // Insert new winner
        sqlStatements.push(
          `INSERT INTO public.chapters (id, manga_id, title, release_date, pages, created_at) ` +
          `VALUES (${escapeSql(newId)}, ${escapeSql(winner.manga_id)}, ${escapeSql(winner.title)}, ${escapeSql(winner.release_date)}, ${formatSqlArray(mergedPages)}, ${escapeSql(winner.created_at)});`
        );
        
        // Update reading progress for the winner's old ID to the new ID
        sqlStatements.push(`UPDATE public.reading_progress SET chapter_id = ${escapeSql(newId)} WHERE chapter_id = ${escapeSql(winner.id)};`);
        
        // Delete winner's old ID
        sqlStatements.push(`DELETE FROM public.chapters WHERE id = ${escapeSql(winner.id)};`);
      } else {
        // Winner exists, update pages if they were merged/changed
        if (winner.pages !== mergedPages) {
          sqlStatements.push(`UPDATE public.chapters SET pages = ${formatSqlArray(mergedPages)} WHERE id = ${escapeSql(newId)};`);
        }
      }

      // 3. Delete all losers
      const loserIdsToDelete = losers.filter(l => l.id !== newId).map(l => l.id);
      if (loserIdsToDelete.length > 0) {
        sqlStatements.push(`DELETE FROM public.chapters WHERE id IN (${loserIdsToDelete.map(id => escapeSql(id)).join(', ')});`);
      }

    } else {
      renameCount++;
      // Just a rename
      const single = group[0];
      sqlStatements.push(`\n-- Rename ${single.id} to ${newId}`);
      sqlStatements.push(
        `INSERT INTO public.chapters (id, manga_id, title, release_date, pages, created_at) ` +
        `VALUES (${escapeSql(newId)}, ${escapeSql(single.manga_id)}, ${escapeSql(single.title)}, ${escapeSql(single.release_date)}, ${formatSqlArray(single.pages)}, ${escapeSql(single.created_at)});`
      );
      sqlStatements.push(`UPDATE public.reading_progress SET chapter_id = ${escapeSql(newId)} WHERE chapter_id = ${escapeSql(single.id)};`);
      sqlStatements.push(`DELETE FROM public.chapters WHERE id = ${escapeSql(single.id)};`);
    }
  }

  // Enable triggers back
  sqlStatements.push("\nALTER TABLE public.reading_progress ENABLE TRIGGER ALL;");
  sqlStatements.push("ALTER TABLE public.chapters ENABLE TRIGGER ALL;");
  sqlStatements.push("COMMIT;");

  const sqlFile = path.join(__dirname, "migration.sql");
  fs.writeFileSync(sqlFile, sqlStatements.join("\n"), "utf-8");
  
  console.log(`\nGenerated SQL migration file at: ${sqlFile}`);
  console.log(`Summary:`);
  console.log(`- Renames: ${renameCount}`);
  console.log(`- Collisions resolved: ${collisionCount}`);
  console.log(`- Total SQL lines: ${sqlStatements.length}`);
}

run().catch(console.error);

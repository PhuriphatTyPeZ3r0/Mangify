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
    // strip out the mangaId if it is present at the start of segment to avoid redundancy
    let suffix = segment;
    if (suffix.startsWith(mangaId)) {
      suffix = suffix.substring(mangaId.length);
    }
    suffix = suffix.replace(/^[-_]+/, "");
    return `${mangaId}-ch-${suffix.toLowerCase()}`;
  }

  return `${mangaId}-ch-${numStr}`;
}

async function migrate() {
  const dryRun = process.argv.includes("--execute") ? false : true;
  console.log(`=== ID Migration v2 Starting (${dryRun ? "DRY RUN" : "LIVE EXECUTION"}) ===`);

  // 1. Fetch all chapters
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

  // 2. Group chapters by their computed new ID
  const groups = {};
  chapters.forEach(ch => {
    const newId = getNewId(ch.manga_id, ch.id, ch.title);
    if (!groups[newId]) {
      groups[newId] = [];
    }
    groups[newId].push(ch);
  });

  console.log(`Grouped into ${Object.keys(groups).length} unique target IDs.`);

  // Analyze collisions & changes
  let totalChanges = 0;
  let totalCollisions = 0;
  const actions = [];

  for (const newId in groups) {
    const group = groups[newId];
    
    // Check if we need to make changes
    const needsMigration = group.some(ch => ch.id !== newId) || group.length > 1;
    if (!needsMigration) continue;

    totalChanges++;

    // Find the winner
    let winner = group.find(ch => ch.id === newId);
    
    if (group.length > 1) {
      totalCollisions++;
      if (!winner) {
        // If the exact clean ID doesn't exist, pick the one with non-empty pages
        winner = group.find(ch => ch.pages && ch.pages.length > 0) || group[0];
      }
      
      const losers = group.filter(ch => ch.id !== winner.id);
      
      // Merge pages if winner is empty but a loser has pages
      let mergedPages = winner.pages;
      if ((!mergedPages || mergedPages.length === 0)) {
        const pageLoser = losers.find(ch => ch.pages && ch.pages.length > 0);
        if (pageLoser) {
          mergedPages = pageLoser.pages;
        }
      }

      actions.push({
        newId,
        type: "COLLISION_RESOLVE",
        winner,
        losers,
        mergedPages
      });
    } else {
      // Just a single row mapping to a new ID
      const single = group[0];
      actions.push({
        newId,
        type: "RENAME",
        winner: single,
        losers: [],
        mergedPages: single.pages
      });
    }
  }

  console.log(`\nAnalysis Summary:`);
  console.log(`- Unique chapters requiring update: ${totalChanges}`);
  console.log(`- Collisions to resolve: ${totalCollisions}`);

  if (dryRun) {
    console.log("\nSample Migration Actions:");
    const samples = actions.slice(0, 5);
    console.log(JSON.stringify(samples, null, 2));
    console.log("\nTo execute live migration, run this command with the --execute flag.");
    return;
  }

  // Live migration execution
  console.log("\nExecuting live migration...");
  
  const batchSize = 50;
  for (let i = 0; i < actions.length; i += batchSize) {
    const batch = actions.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(actions.length / batchSize)} (Actions ${i+1}-${Math.min(i+batchSize, actions.length)})...`);
    
    const promises = batch.map(async (action) => {
      try {
        // 1. If it's a collision resolve:
        if (action.type === "COLLISION_RESOLVE") {
          const winnerExists = action.winner.id === action.newId;
          
          // A. Update reading progress for all losers to point to the target newId
          for (const loser of action.losers) {
            const { error: pErr } = await supabase
              .from("reading_progress")
              .update({ chapter_id: action.newId })
              .eq("chapter_id", loser.id);
            if (pErr) {
              console.error(`  ⚠️ Failed to update reading progress for loser ${loser.id}:`, pErr.message);
            }
          }

          // B. If winner is not already on the target newId (meaning none of the duplicates had the clean ID yet)
          if (!winnerExists) {
            // Insert the winner with the new target ID
            const { error: insErr } = await supabase
              .from("chapters")
              .insert({
                id: action.newId,
                manga_id: action.winner.manga_id,
                title: action.winner.title,
                pages: action.mergedPages || [],
                release_date: action.winner.release_date,
                created_at: action.winner.created_at
              });
            if (insErr) {
              console.error(`  ❌ Failed to insert winner ${action.newId}:`, insErr.message);
              return;
            }
            
            // Update reading progress for the winner too
            const { error: pErr } = await supabase
              .from("reading_progress")
              .update({ chapter_id: action.newId })
              .eq("chapter_id", action.winner.id);
            if (pErr) console.error(`  ⚠️ Failed to update progress for winner ${action.winner.id}:`, pErr.message);
          } else {
            // Winner already exists at newId. Update its pages if they were merged.
            if (action.winner.pages !== action.mergedPages) {
              const { error: updErr } = await supabase
                .from("chapters")
                .update({ pages: action.mergedPages })
                .eq("id", action.newId);
              if (updErr) console.error(`  ⚠️ Failed to update pages for winner ${action.newId}:`, updErr.message);
            }
          }

          // C. Delete all rows that are not the target newId row
          const idsToDelete = groupIdsToDelete(action.winner.id, action.losers, action.newId);
          if (idsToDelete.length > 0) {
            const { error: delErr } = await supabase
              .from("chapters")
              .delete()
              .in("id", idsToDelete);
            if (delErr) {
              console.error(`  ❌ Failed to delete old chapters ${idsToDelete.join(", ")}:`, delErr.message);
            }
          }
        } else if (action.type === "RENAME") {
          // Just a rename: Winner is renamed to newId, no losers.
          // A. Insert the row with the new ID
          const { error: insErr } = await supabase
            .from("chapters")
            .insert({
              id: action.newId,
              manga_id: action.winner.manga_id,
              title: action.winner.title,
              pages: action.winner.pages || [],
              release_date: action.winner.release_date,
              created_at: action.winner.created_at
            });
          if (insErr) {
            console.error(`  ❌ Failed to rename-insert ${action.newId}:`, insErr.message);
            return;
          }

          // B. Update reading progress
          const { error: pErr } = await supabase
            .from("reading_progress")
            .update({ chapter_id: action.newId })
            .eq("chapter_id", action.winner.id);
          if (pErr) {
            console.error(`  ⚠️ Failed to update progress for renamed ${action.winner.id}:`, pErr.message);
          }

          // C. Delete the old row
          const { error: delErr } = await supabase
            .from("chapters")
            .delete()
            .eq("id", action.winner.id);
          if (delErr) {
            console.error(`  ❌ Failed to delete old row ${action.winner.id}:`, delErr.message);
          }
        }
      } catch (e) {
        console.error(`❌ Exception processing ${action.newId}:`, e);
      }
    });

    await Promise.all(promises);
  }

  console.log("🎉 Migration completed successfully!");
}

function groupIdsToDelete(winnerId, losers, newId) {
  const toDelete = [];
  if (winnerId !== newId) {
    toDelete.push(winnerId);
  }
  losers.forEach(l => {
    if (l.id !== newId) {
      toDelete.push(l.id);
    }
  });
  return Array.from(new Set(toDelete));
}

migrate().catch(console.error);

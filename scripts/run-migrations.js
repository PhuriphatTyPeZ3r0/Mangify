const fs = require("fs");
const path = require("path");

// Try to load env variables from .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

// Target schema is determined by CLI arg or NEXT_PUBLIC_SUPABASE_DB_SCHEMA, defaulting to 'public'
const targetSchema = process.argv[2] || process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public";
const connectionString = process.env.SUPABASE_CONNECTION_STRING;

if (!connectionString) {
  console.error("❌ Error: SUPABASE_CONNECTION_STRING is not set in environment or .env.local");
  console.log("Please define it as: postgresql://postgres:[password]@db.hushgvgkclkmswwuzlxb.supabase.co:5432/postgres");
  process.exit(1);
}

// Check and require 'pg' package
let Client;
try {
  Client = require("pg").Client;
} catch (err) {
  console.error("❌ Error: 'pg' package is not installed.");
  console.log("Please run the following command to install it first:");
  console.log("  npm install pg --save-dev");
  process.exit(1);
}

function parseConnectionString(str) {
  try {
    // Robust regex to extract credentials, handling special characters in password
    const regex = /^postgresql:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?#\s]+)/;
    const match = str.match(regex);
    if (!match) return null;
    return {
      user: match[1],
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: match[4] ? parseInt(match[4], 10) : 5432,
      database: match[5]
    };
  } catch (e) {
    return null;
  }
}

async function runMigration() {
  console.log(`🚀 Starting migration runner for schema: [${targetSchema}]`);
  
  const connectionParams = parseConnectionString(connectionString);
  let clientConfig = {};
  
  if (connectionParams) {
    console.log(`  Parsed host: ${connectionParams.host}:${connectionParams.port}, user: ${connectionParams.user}`);
    clientConfig = {
      user: connectionParams.user,
      password: connectionParams.password,
      host: connectionParams.host,
      port: connectionParams.port,
      database: connectionParams.database,
      ssl: { rejectUnauthorized: false }
    };
  } else {
    console.log("  Could not parse connection string as URI, passing raw string.");
    clientConfig = {
      connectionString,
      ssl: { rejectUnauthorized: false }
    };
  }

  const client = new Client(clientConfig);
  await client.connect();

  try {
    // 1. Ensure target schema exists
    console.log(`Creating schema "${targetSchema}" if not exists...`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}";`);

    // 2. Set search path to point to our schema
    await client.query(`SET search_path TO "${targetSchema}", public, auth;`);

    // 3. Load migration SQL files (schema.sql and profiles_2fa_migration.sql)
    const supabaseDir = path.join(__dirname, "../supabase");
    const files = ["schema.sql", "profiles_2fa_migration.sql"];

    for (const file of files) {
      const filePath = path.join(supabaseDir, file);
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Warning: Migration file not found: ${file}`);
        continue;
      }

      console.log(`Running migration file: ${file}...`);
      let sql = fs.readFileSync(filePath, "utf-8");

      // Replace public. table and function references with targetSchema.
      // E.g., "public.manga" -> "dev.manga"
      // Except for auth. schema calls
      sql = sql.replace(/public\./g, `"${targetSchema}".`);

      // Begin transaction
      await client.query("BEGIN;");
      
      try {
        await client.query(sql);
        await client.query("COMMIT;");
        console.log(`✅ Completed migration for: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK;");
        console.error(`❌ Migration failed for file: ${file}`);
        throw err;
      }
    }

    // 4. Update the handle_new_user trigger on auth.users (Global to the DB)
    // to automatically create profiles in the new schema if it exists
    console.log(`Syncing profile creation trigger function in "public" schema...`);
    const triggerSql = `
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
          -- Insert into public schema
          INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
          
          -- Insert into dev schema (if exists)
          BEGIN
              INSERT INTO dev.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          -- Insert into test schema (if exists)
          BEGIN
              INSERT INTO test.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          -- Insert into uat schema (if exists)
          BEGIN
              INSERT INTO uat.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    await client.query(triggerSql);
    console.log("✅ Profile Sync Trigger synced successfully.");

  } catch (err) {
    console.error("❌ Migration failed with error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Read and parse .env.local
const envPath = path.join(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error(".env.local file not found at " + envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      envVars[key] = val;
    }
  }
});

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

console.log("Initializing Supabase Admin client...");
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const TARGET_USER_ID = "6521177c-2e54-4ac7-9ed2-d1ab8d52a17e";
const TARGET_EMAIL = "phuriphathem@gmail.com";

async function makeAdmin() {
  console.log(`Updating user app_metadata for user ID: ${TARGET_USER_ID} (${TARGET_EMAIL})...`);
  
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    TARGET_USER_ID,
    { app_metadata: { role: "admin" } }
  );

  if (error) {
    console.error("Error updating user metadata:", error.message);
    process.exit(1);
  }

  console.log("Successfully updated user metadata!");
  console.log("Updated User Data:", JSON.stringify(data.user, null, 2));
}

makeAdmin().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

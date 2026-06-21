const { createClient } = require("@supabase/supabase-js");
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
  console.log("Repairing you-wont-get-me-twice title...");
  const { error } = await supabaseAdmin
    .from("manga")
    .update({ title: "You Won't Get Me Twice" })
    .eq("id", "you-wont-get-me-twice");

  if (error) {
    console.error("Error repairing title:", error.message);
  } else {
    console.log("Title repaired successfully!");
  }
}

run().catch(console.error);

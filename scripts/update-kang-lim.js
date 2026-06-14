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

const MANGA_ID = "webtoon-character-kang-lim";
const mangaData = {
  id: MANGA_ID,
  title: "Webtoon Character Na Kang Lim",
  author: "LEE Kyung-Min",
  cover: "https://www.up-manga.com/wp-content/uploads/2023/11/Webtoon-Character-Na-Kang-Lim.jpg",
  description: "นาคังลิม นักเรียนมัธยมปลายที่ชอบดูเว็บตูนเป็นประจำ วันหนึ่ง ได้พบกับบางสิ่งที่แปลกประหลาด โดยมีตัวละครเอกหญิงจากเว็บตูนที่เขามักจะอ่านมาปรากฏตัวต่อหน้าเขา เหตุการณ์ในเว็บตูนทำให้เธอตกอยู่ในภาวะวิกฤติ แต่ปัญหาคือไม่มีตัวเอกมาช่วยเธอจากเหตุการณ์เหล่านั้น! จากนั้นเขาก็กลายเป็นตัวเอกและเมื่อเวลาผ่านไปเพื่อช่วยเธอ",
  genres: ["Fantasy", "Harem", "Romance", "School Life", "Shounen", "Slice of Life", "Webtoon", "ชีวิตในโรงเรียน", "มังงะเกาหลี", "ฮาเร็ม", "แฟนตาซี", "โรแมนติก"],
  is_original: true,
  popularity: 150,
  original_title: "수요웹툰ของ 나강림",
  artist: "SONG JoonHyuk",
  status: "Ongoing",
  manga_type: "Manhwa",
  release_year: 2021,
  views_count: "5.5M"
};

async function updateManga() {
  console.log(`Upserting details for manga ID: ${MANGA_ID} in database...`);
  
  const { data, error } = await supabaseAdmin
    .from("manga")
    .upsert(mangaData, { onConflict: "id" })
    .select();

  if (error) {
    console.error("Error upserting manga:", error.message);
    process.exit(1);
  }

  console.log("Successfully upserted manga details!");
  console.log("Updated Database Record:", JSON.stringify(data[0], null, 2));
}

updateManga().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

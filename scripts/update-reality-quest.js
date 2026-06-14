const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Read and parse .env.local
const envPath = path.join(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error(".env.local not found");
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

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const MANGA_ID = "reality-quest";
const mangaData = {
  id: MANGA_ID,
  title: "Reality Quest",
  original_title: "IRL Quest, Real Life Quest, Реалити Квест, 现实闯关, 現實 Quest, 현실 퀘สต์, 현실퀘สต์",
  author: "Lee Joowoon",
  artist: "Taesung (II)",
  cover: "https://www.up-manga.com/wp-content/uploads/2023/09/Reality-Quest.jpg",
  description: "ฮาโดวัน ตกเป็นทาสของเกมโดยสมบูรณ์ เพราะโดนพวกนักเลงในห้องเรียนบังคับให้ตามเก็บไอเทมโคตรแรร์มาให้ได้ หนึ่งสัปดาห์ผ่านไป ทุกอย่างดูเหมือนจะปกติดี… ยกเว้นก็แต่หน้าต่างสถานะที่ปรากฏขึ้นต่อหน้าต่อตา ซึ่งดูเหมือนหลุดออกมาจากเกมที่เขากำลังจำใจเล่นอยู่เปี๊ยบ",
  genres: ["Action", "Comedy", "Drama", "Fantasy", "School Life", "Shounen", "Webtoon", "ชีวิตในโรงเรียน", "มังงะเกาหลี", "ระบบ", "ศิลปะการต่อสู้-แอคชั่น"],
  is_original: true,
  status: "Ongoing",
  manga_type: "Manhwa",
  release_year: 2021,
  popularity: 2127,
  views_count: "5.5M"
};

async function updateManga() {
  console.log(`Updating metadata for: ${MANGA_ID}...`);
  const { data, error } = await supabase
    .from("manga")
    .upsert(mangaData, { onConflict: "id" })
    .select();

  if (error) {
    console.error("Error upserting manga:", error.message);
    process.exit(1);
  }

  console.log("Successfully updated Reality Quest metadata!");
}

updateManga();

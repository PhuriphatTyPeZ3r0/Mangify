/**
 * Shared Genre Translation and Cleansing Utility
 * Works in both Node.js (scripts) and Next.js (BFF API routes)
 */

const genreTranslationMap = {
  // Standard Genres
  "action": "ศิลปะการต่อสู้-แอคชั่น",
  "adventure": "ผจญภัย",
  "comedy": "ตลก",
  "drama": "ดราม่า",
  "fantasy": "แฟนตาซี",
  "harem": "ฮาเร็ม",
  "historical": "ย้อนยุค",
  "martial arts": "ศิลปะการต่อสู้-แอคชั่น",
  "mystery": "ลึกลับ",
  "psychological": "จิตวิทยา",
  "romance": "โรแมนติก",
  "school life": "ชีวิตในโรงเรียน",
  "sci-fi": "ไซไฟ",
  "seinen": "เซเน็น",
  "shoujo": "โชโจ",
  "shounen": "โชเน็น",
  "slice of life": "ชีวิตประจำวัน",
  "sports": "กีฬา",
  "supernatural": "เหนือธรรมชาติ",
  "tragedy": "โศกนาฏกรรม",
  "yuri": "ยูริ",
  "yaoi": "วาย",
  
  // Mature / 18+ Genres
  "bbw": "สาวอวบ",
  "blowjob": "อมอวัยวะเพศ",
  "doujin": "โดจิน",
  "lolicon": "โลลิคอน",
  "milf": "คุณแม่",
  "small breasts": "หน้าอกเล็ก",
  "scarlett ann": "สการ์เล็ต แอน",
  "mature": "ผู้ใหญ่",
  "h-manhwa": "โดจินเกาหลี",
  "family": "ครอบครัว",
  "gangbang": "รุมโทรม",
  "incest": "ค้ำคอร์",
  "netorare": "เอ็นทีอาร์ (โดนแย่งแฟน)",
  "ntr": "เอ็นทีอาร์ (โดนแย่งแฟน)",
  "creampie": "หลั่งใน",
  "masturbation": "สำเร็จความใคร่",
  "paizuri": "หนีบหน้าอก",
  "footjob": "ใช้เท้า",
  "handjob": "ใช้มือ",
  "bondage": "มัดเชือก",
  "sadism": "ซาดิสม์",
  "masochism": "มาโซคิสม์",
  "pregnant": "คนท้อง",
  "uncensored": "ไม่เซ็นเซอร์",
  "censored": "เซ็นเซอร์",
  "anal": "ทางทวารหนัก",
  
  // Country Types
  "manhwa": "มังฮวาเกาหลี",
  "manga": "มังงะญี่ปุ่น",
  "manhua": "มังฮวาจีน",
  "มังฮวาภาพสี": "มังฮวาเกาหลี",
  "มังงะญี่ปุ่น": "มังงะญี่ปุ่น",
  "มังฮวาเกาหลี": "มังฮวาเกาหลี",
  "มังฮวาจีน": "มังฮวาจีน",
  "โดจินเกาหลี hmanhwa": "โดจินเกาหลี",
  "โดจินเกาหลี-hmanhwa": "โดจินเกาหลี",
  "โดจินเกาหลี": "โดจินเกาหลี",
  "เกาหลี hmanhwa": "โดจินเกาหลี",
  "เกาหลี-hmanhwa": "โดจินเกาหลี",
  "เกาหลี": "โดจินเกาหลี",
  "ภาพสี": "โดจินภาพสี",
  "โดจินภาพสี": "โดจินภาพสี",
  "ภัยภิบัติ": "ภัยพิบัติ",
  "ภัยพิบัติ": "ภัยพิบัติ"
};

const ignoredTags = new Set(["webtoon", "kakao", "korean", "japanese", "chinese"]);

/**
 * Cleans and translates a list of genres/tags (synchronous dictionary lookup)
 * @param {string[]} genres Array of raw genre strings
 * @returns {string[]} Cleaned and translated Thai genre strings
 */
function cleanGenres(genres) {
  if (!genres || !Array.isArray(genres)) return [];
  
  const cleanedList = genres
    .map(g => {
      if (!g || typeof g !== "string") return "";
      
      // 1. Lowercase for mapping and trim whitespace
      const rawVal = g.trim().toLowerCase();
      if (!rawVal) return "";

      // Ignore list
      if (ignoredTags.has(rawVal)) return "";

      // 2. Try matching raw lowercase directly in translation map
      if (genreTranslationMap[rawVal]) {
        return genreTranslationMap[rawVal];
      }

      // 3. Remove prefixes like "หมวดหมู่", "โดจิน" and try matching again
      let strippedVal = rawVal.replace(/^หมวดหมู่\s*/gi, "");
      strippedVal = strippedVal.replace(/^โดจิน\s*/gi, "");
      strippedVal = strippedVal.trim();

      if (!strippedVal) return "";
      if (ignoredTags.has(strippedVal)) return "";

      if (genreTranslationMap[strippedVal]) {
        return genreTranslationMap[strippedVal];
      }

      // 4. Auto-cleansing for unmapped items (capitalize first letters)
      const hasThai = /[\u0e00-\u0e7f]/.test(g);
      if (hasThai) {
        return g.trim().replace(/^หมวดหมู่\s*/gi, "").replace(/^โดจิน\s*/gi, "").trim();
      }

      // English formatting
      return strippedVal
        .split(/[\s-_]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    })
    .filter(g => g !== "");
  
  // Return unique values
  return Array.from(new Set(cleanedList));
}

/**
 * Translates a given English string to Thai using Google's free translation API
 * @param {string} text 
 * @returns {Promise<string>} Translated string in Thai, or the original on error
 */
async function translateToThai(text) {
  if (!text || typeof text !== "string") return "";
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=th&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0].trim();
    }
  } catch (error) {
    console.error(`⚠️ Error auto-translating "${text}" to Thai:`, error.message);
  }
  return text; // Fallback
}

/**
 * Cleans and translates a list of genres/tags asynchronously, translating any unmapped English genres to Thai automatically.
 * @param {string[]} genres Array of raw genre strings
 * @returns {Promise<string[]>} Cleaned and translated Thai genre strings
 */
async function cleanGenresAsync(genres) {
  if (!genres || !Array.isArray(genres)) return [];
  const cleaned = cleanGenres(genres);
  
  const result = [];
  for (const g of cleaned) {
    const hasThai = /[\u0e00-\u0e7f]/.test(g);
    if (!hasThai) {
      // If it has no Thai characters, it's likely English, so translate it!
      const translated = await translateToThai(g);
      const finalVal = translated.replace(/^หมวดหมู่\s*/gi, "").replace(/^โดจิน\s*/gi, "").trim();
      if (finalVal) {
        result.push(finalVal);
      }
    } else {
      result.push(g);
    }
  }
  return Array.from(new Set(result));
}

module.exports = {
  genreTranslationMap,
  cleanGenres,
  cleanGenresAsync
};

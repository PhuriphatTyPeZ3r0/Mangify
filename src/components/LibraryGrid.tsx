import React from "react";
import { Manga } from "../types";

interface LibraryGridProps {
  activeTab: string;
  selectedGenre: string | null;
  sortBy: string;
  filteredMangas: Manga[];
  bookmarks: string[];
  allMangas: Manga[]; // Needed for ranking numbers
  onSelectManga: (manga: Manga) => void;
  onToggleBookmark: (e: React.MouseEvent, mangaId: string) => void;
  onTabChange: (tab: string) => void;
  headerExtra?: React.ReactNode;
}

export const LibraryGrid: React.FC<LibraryGridProps> = ({
  activeTab,
  selectedGenre,
  sortBy,
  filteredMangas,
  bookmarks,
  allMangas,
  onSelectManga,
  onToggleBookmark,
  onTabChange,
  headerExtra,
}) => {
  return (
    <>
      {/* Dynamic Section Header Title */}
      <h2 className="prompt-semibold text-xl mb-6 flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {activeTab === "originals" && <span className="material-symbols-outlined text-[20px] opacity-70">auto_awesome</span>}
          {activeTab === "genres" && <span className="material-symbols-outlined text-[20px] opacity-70">filter_list</span>}
          {activeTab === "ranking" && <span className="material-symbols-outlined text-[20px] opacity-70">trending_up</span>}
          {activeTab === "bookmarks" && <span className="material-symbols-outlined text-[20px] opacity-70">bookmark</span>}
          {activeTab === "originals" && "มังงะแนะนำสำหรับคุณ"}
          {activeTab === "genres" && `หมวดหมู่${selectedGenre ? `: ${selectedGenre}` : "ทั้งหมด"}`}
          {activeTab === "ranking" && "การจัดอันดับมังงะสุดฮิต"}
          {activeTab === "bookmarks" && "บุ๊กมาร์กของฉัน"}
        </div>
        {headerExtra}
      </h2>

      {/* Library Grid */}
      {filteredMangas.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-10 mb-16">
          {filteredMangas.map((manga) => (
            <article 
              key={manga.id} 
              onClick={() => onSelectManga(manga)}
              className="flex flex-col cursor-pointer group"
            >
              <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-surface shadow-sm transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-lg border border-border/20">
                {/* Skeleton Loader Backdrop */}
                <div className="absolute inset-0 skeleton z-0" />
                <img 
                  src={manga.cover} 
                  alt={`${manga.title} Cover`}
                  className="relative w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
                  loading="lazy"
                  onLoad={(e) => {
                    (e.target as HTMLImageElement).classList.add("opacity-100");
                  }}
                />
                {/* Bookmark Button */}
                <button
                  onClick={(e) => onToggleBookmark(e, manga.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border text-foreground hover:text-accent hover:scale-110 transition-all z-20 shadow-sm cursor-pointer"
                  title={bookmarks.includes(manga.id) ? "ยกเลิกบุ๊กมาร์ก" : "บันทึกบุ๊กมาร์ก"}
                >
                  <span className={`material-symbols-outlined text-[14px] ${bookmarks.includes(manga.id) ? "fill text-accent" : "opacity-70"}`}>
                    bookmark
                  </span>
                </button>
                {/* Badge showing ranking if in Ranking Tab */}
                {activeTab === "ranking" && sortBy === "popular" && (
                  <div className="absolute top-2 left-2 bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md">
                    {allMangas.findIndex(m => m.id === manga.id) + 1}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <h3 className="prompt-semibold text-md line-clamp-1 group-hover:text-accent transition-colors">
                  {manga.title}
                </h3>
                <p className="prompt-light text-xs opacity-60 mt-0.5">{manga.author}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-border/60 rounded-xl mb-16">
          <span className="material-symbols-outlined text-[40px] opacity-50 mb-3 select-none">search</span>
          <p className="prompt-medium text-lg opacity-70">ไม่พบผลงานที่ต้องการในขณะนี้</p>
          <button 
            onClick={() => onTabChange("originals")}
            className="mt-3 text-xs prompt-medium text-accent hover:underline"
          >
            กลับหน้าหลัก
          </button>
        </div>
      )}
    </>
  );
};

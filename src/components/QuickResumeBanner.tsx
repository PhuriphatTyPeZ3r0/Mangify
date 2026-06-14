import React from "react";
import { Manga, ReadingProgress } from "../types";

interface QuickResumeBannerProps {
  history: ReadingProgress | null;
  mangas: Manga[];
  onLaunchReader: (manga: Manga, chapterId: string, pageIndex?: number, scrollPct?: number) => void;
}

export const QuickResumeBanner: React.FC<QuickResumeBannerProps> = ({
  history,
  mangas,
  onLaunchReader,
}) => {
  if (!history) return null;

  const lastManga = mangas.find(m => m.id === history.mangaId);
  if (!lastManga) return null;

  const lastChapter = lastManga.chapters.find(ch => ch.id === history.chapterId);

  return (
    <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
      <div 
        onClick={() => onLaunchReader(lastManga, history.chapterId, history.pageIndex, history.scrollPercent)}
        className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all hover:border-accent hover:shadow-lg active:scale-98"
      >
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-accent/10 transition-colors" />
        
        <div className="flex items-center gap-4 sm:gap-6 min-w-0 z-10">
          <div className="w-12 h-16 sm:w-16 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-border/40">
            <img src={lastManga.cover} alt="Cover" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] prompt-bold uppercase tracking-widest text-accent">อ่านค้างไว้ล่าสุด</span>
            </div>
            <h3 className="prompt-bold text-lg sm:text-xl truncate group-hover:text-accent transition-colors">
              {lastManga.title}
            </h3>
            <p className="prompt-light text-xs opacity-60 truncate">
              {lastChapter?.title || "ตอนล่าสุด"} • หน้าที่ {history.pageIndex + 1} ({Math.round(history.scrollPercent)}%)
            </p>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-2 z-10">
          <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-md transition-transform group-hover:scale-110">
            <span className="material-symbols-outlined text-[24px]">play_arrow</span>
          </div>
          <span className="text-[10px] prompt-medium opacity-40 uppercase tracking-tighter">คลิกเพื่ออ่านต่อ</span>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { Manga, ReadingProgress } from "../types";

interface MangaInfoModalProps {
  manga: Manga;
  onClose: () => void;
  history: ReadingProgress | null;
  bookmarks: string[];
  onLaunchReader: (manga: Manga, chapterId: string, pageIndex?: number, scrollPct?: number) => void;
  onToggleBookmark: (e: React.MouseEvent, mangaId: string) => void;
}

export const MangaInfoModal: React.FC<MangaInfoModalProps> = ({
  manga,
  onClose,
  history,
  bookmarks,
  onLaunchReader,
  onToggleBookmark,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[1500] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-surface border border-border w-full max-w-4xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh] animate-in zoom-in-95 duration-300">
        
        {/* Ambient Blurred Cover Glow Backdrop */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-[0.08] dark:opacity-[0.15] filter blur-3xl scale-110 pointer-events-none z-0"
          style={{ backgroundImage: `url(${manga.cover})` }}
        />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-25 p-2 rounded-full bg-background/50 hover:bg-background/80 border border-border/40 text-foreground flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
          aria-label="Close details modal"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Left Column: Cover & Quick Actions */}
        <div className="w-full md:w-[280px] p-6 flex flex-col items-center md:items-stretch border-r border-border/40 z-10 bg-background/20 backdrop-blur-xs">
          <div className="relative w-44 md:w-full aspect-[2/3] rounded-xl overflow-hidden shadow-xl border border-border/20 mb-6 group">
            <img 
              src={manga.cover} 
              alt={`${manga.title} Cover`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>

          {/* Quick Reading Actions */}
          <div className="w-full space-y-3">
            {/* Primary Action Button: Resume or Start */}
            {history && history.mangaId === manga.id ? (
              <button
                onClick={() => {
                  onLaunchReader(manga, history.chapterId, history.pageIndex, history.scrollPercent);
                  onClose();
                }}
                className="w-full bg-accent hover:opacity-95 text-white prompt-semibold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                อ่านต่อ ({manga.chapters.find(ch => ch.id === history.chapterId)?.title || "ล่าสุด"})
              </button>
            ) : null}

            <button
              onClick={() => {
                if (manga.chapters.length > 0) {
                  onLaunchReader(manga, manga.chapters[0].id, 0, 0);
                  onClose();
                }
              }}
              className={`w-full prompt-semibold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 ${
                history && history.mangaId === manga.id
                  ? "bg-surface border border-border text-foreground hover:border-accent"
                  : "bg-accent hover:opacity-95 text-white shadow-md"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              เริ่มอ่านตอนแรก
            </button>

            {/* Bookmark Toggle */}
            <button
              onClick={(e) => onToggleBookmark(e, manga.id)}
              className="w-full bg-surface border border-border hover:border-accent text-foreground prompt-medium text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
            >
              <span className={`material-symbols-outlined text-[16px] ${bookmarks.includes(manga.id) ? "fill text-accent" : ""}`}>
                bookmark
              </span>
              {bookmarks.includes(manga.id) ? "บันทึกแล้ว (ยกเลิก)" : "เพิ่มลงคลังหนังสือ"}
            </button>
          </div>
        </div>

        {/* Right Column: Information & Chapter List */}
        <div className="flex-1 p-6 md:p-8 flex flex-col max-h-[55vh] md:max-h-none overflow-y-auto md:overflow-hidden z-10 relative">
          {/* Header Info */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {manga.type && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent">
                  {manga.type}
                </span>
              )}
              {manga.status && (
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                  manga.status === "Ongoing" 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                }`}>
                  {manga.status === "Ongoing" ? "กำลังดำเนินอยู่" : "จบแล้ว"}
                </span>
              )}
              {manga.year && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-foreground/5 opacity-70">
                  ปี {manga.year}
                </span>
              )}
            </div>
            
            <h2 className="prompt-bold text-2xl md:text-3xl leading-tight mb-1">{manga.title}</h2>
            
            {manga.originalTitle && (
              <p className="prompt-light text-sm opacity-60 mb-2 italic" lang="ko">
                {manga.originalTitle}
              </p>
            )}

            <p className="prompt-medium text-xs opacity-75">
              <span>ผู้แต่ง: <strong className="opacity-90">{manga.author || "ไม่ระบุ"}</strong></span>
              {manga.artist && (
                <span className="ml-4">ผู้วาด: <strong className="opacity-90">{manga.artist}</strong></span>
              )}
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 py-3 border-y border-border/30 mb-5 text-center prompt-regular text-xs bg-surface/30 rounded-xl px-2">
            <div>
              <span className="opacity-50 block text-[10px] uppercase tracking-wider mb-0.5">ผู้เข้าชม</span>
              <span className="font-semibold flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px] opacity-70">visibility</span>
                {manga.views || "0"}
              </span>
            </div>
            <div>
              <span className="opacity-50 block text-[10px] uppercase tracking-wider mb-0.5">บันทึก</span>
              <span className="font-semibold flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px] opacity-70">favorite</span>
                {manga.popularity || "0"}
              </span>
            </div>
            <div>
              <span className="opacity-50 block text-[10px] uppercase tracking-wider mb-0.5">ตอนทั้งหมด</span>
              <span className="font-semibold flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px] opacity-70">list</span>
                {manga.chapters.length} ตอน
              </span>
            </div>
          </div>

          {/* Genres badges */}
          {manga.genres && manga.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {manga.genres.map((g) => (
                <span 
                  key={g} 
                  className="text-[10px] prompt-medium bg-surface hover:border-accent border border-border px-2.5 py-1 rounded-full cursor-default transition-colors"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="mb-6 flex-shrink-0">
            <h4 className="prompt-semibold text-xs uppercase tracking-wider opacity-60 mb-1.5">เรื่องย่อ</h4>
            <p className="prompt-light text-xs md:text-sm opacity-85 leading-relaxed max-h-24 overflow-y-auto scrollbar-thin pr-1">
              {manga.description || "ไม่มีเรื่องย่อสำหรับมังงะเรื่องนี้"}
            </p>
          </div>

          {/* Divider */}
          <div className="h-[1px] bg-border/40 mb-4 flex-shrink-0" />

          {/* Chapter list section */}
          <div className="flex-1 flex flex-col min-h-[200px] overflow-hidden">
            <h4 className="prompt-semibold text-xs uppercase tracking-wider opacity-60 mb-2 flex-shrink-0 flex justify-between items-center">
              <span>รายชื่อตอน</span>
              <span className="text-[10px] font-normal opacity-80">เรียงตามการปล่อย</span>
            </h4>

            <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 pb-2 space-y-2">
              {manga.chapters.length > 0 ? (
                manga.chapters.map((ch) => {
                  const isCurrentProgress = history && history.mangaId === manga.id && history.chapterId === ch.id;
                  return (
                    <div 
                      key={ch.id}
                      onClick={() => {
                        onLaunchReader(manga, ch.id, 0, 0);
                        onClose();
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
                        isCurrentProgress
                          ? "bg-accent/5 border-accent text-accent font-semibold"
                          : "bg-surface/50 hover:bg-surface border-border/50 hover:border-accent/30"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`material-symbols-outlined text-[18px] transition-transform group-hover:scale-110 ${
                          isCurrentProgress ? "text-accent fill" : "opacity-40"
                        }`}>
                          {isCurrentProgress ? "play_circle" : "chrome_reader_mode"}
                        </span>
                        <span className="prompt-medium text-xs md:text-sm truncate pr-2">
                          {ch.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isCurrentProgress && (
                          <span className="text-[9px] uppercase prompt-bold tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent">
                            กำลังอ่าน {history.scrollPercent > 0 ? `${Math.round(history.scrollPercent)}%` : ""}
                          </span>
                        )}
                        <span className="material-symbols-outlined text-[16px] opacity-0 group-hover:opacity-100 group-hover:text-accent transition-all">
                          arrow_forward
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 opacity-50 text-xs">
                  ไม่มีตอนให้อ่านในขณะนี้
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

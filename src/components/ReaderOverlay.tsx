import React from "react";
import { Manga, ReadingMode } from "../types";

interface ReaderOverlayProps {
  activeManga: Manga;
  activeChapterId: string;
  currentPageIndex: number;
  scrollPercent: number;
  readingMode: ReadingMode;
  showControls: boolean;
  isChapterPanelOpen: boolean;
  readerContentRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onReaderScroll: () => void;
  onToggleControls: () => void;
  onNavigateHorizontal: (direction: number) => void;
  onLaunchReader: (manga: Manga, chapterId: string, pageIndex?: number, scrollPct?: number) => void;
  onSetReadingMode: (mode: ReadingMode) => void;
  onToggleChapterPanel: (isOpen: boolean) => void;
  resetControlsTimeout: () => void;
}

export const ReaderOverlay: React.FC<ReaderOverlayProps> = ({
  activeManga,
  activeChapterId,
  currentPageIndex,
  scrollPercent,
  readingMode,
  showControls,
  isChapterPanelOpen,
  readerContentRef,
  onClose,
  onReaderScroll,
  onToggleControls,
  onNavigateHorizontal,
  onLaunchReader,
  onSetReadingMode,
  onToggleChapterPanel,
  resetControlsTimeout,
}) => {
  const currentChapter = activeManga.chapters.find(ch => ch.id === activeChapterId);
  const currentChapterIdx = activeManga.chapters.findIndex(ch => ch.id === activeChapterId);

  // Track finger movement to separate scrolling/swiping from clean tapping
  const touchMovedRef = React.useRef(false);

  const handleTouchStart = () => {
    touchMovedRef.current = false;
  };

  const handleTouchMove = () => {
    touchMovedRef.current = true;
  };

  const handleClick = () => {
    if (touchMovedRef.current) {
      touchMovedRef.current = false;
      return;
    }
    if (readingMode === "vertical") {
      onToggleControls();
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-background z-[1000] flex flex-col select-none overflow-hidden transition-colors">
      
      {/* Top Control Bar */}
      <header className={`fixed top-0 left-0 w-full bg-background/95 backdrop-blur-md z-[1010] p-4 px-6 flex justify-between items-center border-b border-border transition-all duration-300 ${
        (showControls || isChapterPanelOpen) ? "translate-y-0" : "-translate-y-full"
      }`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="flex items-center gap-1 prompt-medium text-sm hover:translate-x-[-3px] transition-transform flex items-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            Library
          </button>
          <h2 className="prompt-semibold text-md truncate max-w-[200px] sm:max-w-md">
            {activeManga.title} <span className="prompt-light text-xs opacity-60 ml-2">({currentChapter?.title})</span>
          </h2>
        </div>
        
        {/* Top horizontal progress bar indicator */}
        <div 
          className="absolute bottom-0 left-0 h-[3px] bg-accent transition-all duration-150" 
          style={{ width: `${scrollPercent}%` }}
        />
      </header>

      {/* Core Reader Viewer Area */}
      <div 
        ref={readerContentRef}
        onScroll={onReaderScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onClick={handleClick}
        className="flex-1 w-full overflow-x-hidden relative flex flex-col items-center justify-start focus:outline-none"
        style={{ 
          overflowY: readingMode === "vertical" ? "auto" : "hidden" 
        }}
      >
        {/* Click handlers overlay */}
        {readingMode === "horizontal" && (
          <div className="absolute inset-0 w-full h-full flex z-[999] pointer-events-none">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                onNavigateHorizontal(-1);
              }}
              className="w-[20%] h-full cursor-w-resize pointer-events-auto"
            />
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onClick={(e) => {
                e.stopPropagation();
                if (touchMovedRef.current) {
                  touchMovedRef.current = false;
                  return;
                }
                onToggleControls();
              }}
              className="w-[60%] h-full cursor-pointer pointer-events-auto"
            />
            <div 
              onClick={(e) => {
                e.stopPropagation();
                onNavigateHorizontal(1);
              }}
              className="w-[20%] h-full cursor-e-resize pointer-events-auto"
            />
          </div>
        )}

        {/* Vertical Scroll Layout */}
        {readingMode === "vertical" ? (
          <div className="w-full max-w-[700px] mx-auto flex flex-col relative z-10">
            {currentChapter?.pages.map((url, idx) => (
              <div key={idx} className="w-full relative min-h-[400px] bg-surface/30">
                <div className="absolute inset-0 skeleton opacity-20" />
                <img 
                  src={url} 
                  alt={`Page ${idx + 1}`}
                  className="w-full h-auto block manga-page-img relative z-10 transition-opacity duration-500 opacity-0"
                  loading={idx > 2 ? "lazy" : "eager"}
                  onLoad={(e) => (e.target as HTMLImageElement).classList.replace("opacity-0", "opacity-100")}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Horizontal Page Switch Layout */
          <div className="w-full h-full flex justify-center items-center p-4">
            <div className="max-w-[90%] max-h-[95%] flex items-center justify-center relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 skeleton opacity-10" />
              {currentChapter && (
                <img 
                  key={currentPageIndex} // Key trigger for re-render animation
                  src={currentChapter.pages[currentPageIndex]} 
                  alt={`Page ${currentPageIndex + 1}`}
                  className="max-h-[92vh] max-w-full object-contain shadow-md manga-page-img animate-in fade-in slide-in-from-right-4 duration-300 relative z-10"
                  onLoad={(e) => (e.target as HTMLImageElement).classList.add("opacity-100")}
                />
              )}
            </div>
            {/* Page Indicator */}
            {currentChapter && (
              <div className="fixed bottom-6 right-6 bg-surface/80 border border-border backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs prompt-semibold z-[1005]">
                {currentPageIndex + 1} / {currentChapter.pages.length}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <footer className={`fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-md z-[1010] p-4 px-6 flex justify-between items-center border-t border-border transition-all duration-300 ${
        (showControls || isChapterPanelOpen) ? "translate-y-0" : "translate-y-full"
      }`}>
        <div className="flex items-center gap-2">
          <span className="prompt-light text-xs uppercase tracking-wider opacity-60 hidden sm:inline">Layout:</span>
          <button 
            onClick={() => {
              onSetReadingMode(readingMode === "vertical" ? "horizontal" : "vertical");
              resetControlsTimeout();
            }}
            className="bg-surface border border-border text-foreground text-xs prompt-medium px-4 py-1.5 rounded-full hover:border-accent transition-colors cursor-pointer"
          >
            {readingMode === "vertical" ? "Webtoon (Vertical)" : "Manga (Horizontal)"}
          </button>
        </div>

        {/* Chapter Selector Dropdown */}
        <div className="relative">
          {/* Overlay Backdrop to close menu */}
          {isChapterPanelOpen && (
            <div 
              className="fixed inset-0 z-[1015] bg-transparent"
              onClick={() => {
                onToggleChapterPanel(false);
                resetControlsTimeout();
              }}
            />
          )}

          <div className="flex items-center gap-1 bg-surface border border-border rounded-full p-1 shadow-sm relative z-[1020]">
            {/* Prev Button */}
            <button
              disabled={currentChapterIdx <= 0}
              onClick={() => {
                if (currentChapterIdx > 0) {
                  const prevChId = activeManga.chapters[currentChapterIdx - 1].id;
                  onLaunchReader(activeManga, prevChId, 0, 0);
                }
                resetControlsTimeout();
              }}
              className="p-1 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
              title="ตอนก่อนหน้า"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>

            {/* Chapter Pill Button */}
            <button 
              onClick={() => {
                onToggleChapterPanel(!isChapterPanelOpen);
                resetControlsTimeout();
              }}
              className="px-3 py-1 rounded-full text-foreground text-xs prompt-medium hover:bg-foreground/5 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="max-w-[120px] sm:max-w-[160px] truncate">
                {currentChapter?.title || "เลือกตอน"}
              </span>
              {isChapterPanelOpen ? (
                <span className="material-symbols-outlined text-[14px] text-accent opacity-80">expand_less</span>
              ) : (
                <span className="material-symbols-outlined text-[14px] opacity-60">expand_more</span>
              )}
            </button>

            {/* Next Button */}
            <button
              disabled={currentChapterIdx >= activeManga.chapters.length - 1}
              onClick={() => {
                if (currentChapterIdx < activeManga.chapters.length - 1) {
                  const nextChId = activeManga.chapters[currentChapterIdx + 1].id;
                  onLaunchReader(activeManga, nextChId, 0, 0);
                }
                resetControlsTimeout();
              }}
              className="p-1 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
              title="ตอนถัดไป"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          {/* Popover list of Chapters */}
          {isChapterPanelOpen && (
            <div className="absolute bottom-[48px] right-0 sm:right-1/2 sm:translate-x-1/2 z-[1025] w-64 max-h-72 overflow-y-auto bg-surface border border-border rounded-2xl shadow-xl p-1.5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 scrollbar-thin">
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-foreground/50 prompt-semibold border-b border-border/50 mb-1 select-none">
                เลือกตอน ({activeManga.chapters.length} ตอน)
              </div>
              <div className="space-y-0.5 max-h-60 overflow-y-auto pr-0.5">
                {activeManga.chapters.map((ch) => {
                  const isActive = ch.id === activeChapterId;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        onLaunchReader(activeManga, ch.id, 0, 0);
                        onToggleChapterPanel(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs prompt-medium transition-all duration-150 flex items-center justify-between cursor-pointer ${
                        isActive 
                          ? "bg-accent/10 text-accent font-semibold" 
                          : "text-foreground hover:bg-foreground/5"
                      }`}
                    >
                      <span className="truncate">{ch.title}</span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </footer>

    </div>
  );
};

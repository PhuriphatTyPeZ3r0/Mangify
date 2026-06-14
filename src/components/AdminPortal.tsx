import React from "react";

interface AdminPortalProps {
  adminInput: {
    mangaId: string;
    chapterId: string;
    chapterTitle: string;
    zipUrl: string;
  };
  onAdminInputChange: (field: string, value: string) => void;
  adminLogs: string[];
  ingesting: boolean;
  onIngest: (e: React.FormEvent) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminInput,
  onAdminInputChange,
  adminLogs,
  ingesting,
  onIngest,
}) => {
  return (
    <div className="max-w-2xl mx-auto py-10 px-6 bg-surface border border-border rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-2xl bg-accent/10 text-accent">
          <span className="material-symbols-outlined text-[32px]">shield_person</span>
        </div>
        <div>
          <h2 className="prompt-bold text-2xl">แผงควบคุมผู้ดูแลระบบ</h2>
          <p className="prompt-light text-xs opacity-60">ระบบนำเข้ามังงะและจัดการเนื้อหาผ่าน API</p>
        </div>
      </div>
      
      <form onSubmit={onIngest} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-xs prompt-semibold opacity-70 px-1">Manga ID (Slug)</label>
            <input 
              required
              placeholder="เช่น neon-heart"
              value={adminInput.mangaId}
              onChange={(e) => onAdminInputChange("mangaId", e.target.value)}
              className="w-full text-sm prompt-regular px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs prompt-semibold opacity-70 px-1">Chapter ID</label>
            <input 
              required
              placeholder="เช่น ch-1"
              value={adminInput.chapterId}
              onChange={(e) => onAdminInputChange("chapterId", e.target.value)}
              className="w-full text-sm prompt-regular px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs prompt-semibold opacity-70 px-1">Chapter Title (ชื่อตอน)</label>
          <input 
            required
            placeholder="เช่น ตอนที่ 1: จุดเริ่มต้น"
            value={adminInput.chapterTitle}
            onChange={(e) => onAdminInputChange("chapterTitle", e.target.value)}
            className="w-full text-sm prompt-regular px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs prompt-semibold opacity-70 px-1 flex justify-between">
            <span>ZIP Download URL (Direct Link)</span>
            <span className="text-[10px] text-accent opacity-80 uppercase tracking-tighter">Required for automation</span>
          </label>
          <input 
            type="url"
            required
            placeholder="https://example.com/manga.zip"
            value={adminInput.zipUrl}
            onChange={(e) => onAdminInputChange("zipUrl", e.target.value)}
            className="w-full text-sm prompt-regular px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <button 
          disabled={ingesting}
          className="w-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 py-4 rounded-2xl prompt-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg active:scale-98 cursor-pointer"
        >
          {ingesting ? (
            <>
              <span className="material-symbols-outlined animate-spin">sync</span>
              กำลังดำเนินการนำเข้า...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">publish</span>
              ยืนยันการนำเข้าข้อมูล (Trigger Ingest)
            </>
          )}
        </button>
      </form>

      {/* Admin Logs Panel */}
      {adminLogs.length > 0 && (
        <div className="mt-10 pt-8 border-t border-border/60">
          <h3 className="text-xs prompt-bold opacity-50 uppercase tracking-widest mb-4 px-1">System Logs</h3>
          <div className="bg-background/50 border border-border rounded-xl p-4 font-mono text-[10px] max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin shadow-inner">
            {adminLogs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-accent opacity-50">[{new Date().toLocaleTimeString()}]</span>
                <span className="opacity-90">{log}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

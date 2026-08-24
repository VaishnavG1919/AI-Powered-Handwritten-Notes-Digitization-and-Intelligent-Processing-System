import { useState, useCallback, useRef } from "react";
import { X, UploadCloud, File as FileIcon, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { uploadDocument, apiErrorMessage } from "../lib/api";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "kn", label: "Kannada" },
];

export function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: (docId: string) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter((f) =>
      /\.(jpe?g|png|webp|heic|pdf)$/i.test(f.name)
    );
    if (arr.length === 0) {
      toast.error("Only images (JPG, PNG, WEBP) or PDF files are supported.");
      return;
    }
    setFiles((prev) => [...prev, ...arr]);
  }, []);

  async function handleUpload() {
    if (files.length === 0) {
      toast.error("Add at least one image or PDF first.");
      return;
    }
    setUploading(true);
    try {
      const doc = await uploadDocument(files, title || "Untitled Notes", language);
      toast.success("Upload started — processing your pages now.");
      onUploaded(doc.id);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-paper-50 dark:bg-ink-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-semibold">Upload handwritten notes</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-ink-900/5 dark:hover:bg-paper-100/10">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium mb-1.5 block">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Thermodynamics — Chapter 3"
            className="w-full px-3.5 py-2.5 rounded-xl border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-800 focus:border-violet-500 outline-none text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium mb-1.5 block">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-800 focus:border-violet-500 outline-none text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            dragging ? "border-violet-500 bg-violet-500/5" : "border-ink-900/20 dark:border-paper-100/20 hover:border-violet-400"
          }`}
        >
          <UploadCloud size={28} className="mx-auto mb-2 text-violet-500" />
          <p className="text-sm font-medium">Drag & drop images or a PDF here</p>
          <p className="text-xs text-ink-900/50 dark:text-paper-100/50 mt-1">or click to browse — multiple pages supported</p>
          <input
            ref={inputRef} type="file" multiple hidden accept=".jpg,.jpeg,.png,.webp,.heic,.pdf"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <ul className="mt-4 space-y-1.5 max-h-40 overflow-y-auto thin-scroll">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-white dark:bg-ink-800">
                <span className="flex items-center gap-2 truncate">
                  <FileIcon size={14} className="text-ink-400 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
                <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-ink-400 hover:text-bad-500">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full mt-6 py-3 rounded-xl bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors disabled:opacity-60"
        >
          {uploading ? "Uploading…" : `Upload ${files.length > 0 ? `(${files.length} file${files.length > 1 ? "s" : ""})` : ""}`}
        </button>
      </div>
    </div>
  );
}

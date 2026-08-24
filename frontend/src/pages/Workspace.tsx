import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  ArrowLeft, Columns2, Pencil, Save,
  Sparkles, Loader2, Download, ChevronDown, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { StatusBadge } from "../components/Common";
import { AiPanel } from "../components/AiPanel";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import {
  getDocument, updatePage, explainTopic, downloadExport, apiErrorMessage,
  type DocumentDetailOut,
} from "../lib/api";

const EXPLAIN_MODES = [
  { v: "simple", l: "Explain simply" },
  { v: "detailed", l: "Explain in detail" },
  { v: "exam", l: "Explain for an exam" },
  { v: "example", l: "Give an example" },
  { v: "beginner", l: "Explain like a beginner" },
];

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocumentDetailOut | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState("");
  const [explainMenuOpen, setExplainMenuOpen] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!id) return;
    try {
      const d = await getDocument(id);
      setDoc(d);
      if (!activePageId && d.pages.length > 0) setActivePageId(d.pages[0].id);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!doc) return;
    const active = doc.status === "processing" || doc.pages.some((p) => !["ready", "failed"].includes(p.status));
    if (!active) return;
    const interval = setInterval(load, 2500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const activePage = doc?.pages.find((p) => p.id === activePageId) || null;

  function startEdit() {
    if (!activePage) return;
    setDraft(activePage.content);
    setEditing(true);
  }

  async function saveEdit() {
    if (!activePage) return;
    setSaving(true);
    try {
      const updated = await updatePage(activePage.id, draft);
      setDoc((prev) => prev ? { ...prev, pages: prev.pages.map((p) => (p.id === updated.id ? updated : p)) } : prev);
      setEditing(false);
      toast.success("Saved.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleMouseUp() {
    const sel = window.getSelection()?.toString().trim() || "";
    setSelection(sel);
  }

  async function runExplain(mode: string) {
    if (!id || !selection) return;
    setExplainMenuOpen(false);
    setExplaining(true);
    setExplanation(null);
    try {
      const result = await explainTopic(id, selection, mode);
      setExplanation(result);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setExplaining(false);
    }
  }

  async function handleExport(fmt: string) {
    if (!doc) return;
    setExportOpen(false);
    try {
      await downloadExport(doc.id, fmt, `${doc.title}.${fmt}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (!doc) {
    return <div className="min-h-screen bg-paper-50 dark:bg-ink-950 flex items-center justify-center"><Loader2 className="animate-spin text-violet-500" /></div>;
  }

  return (
    <div className="h-screen flex flex-col bg-paper-50 dark:bg-ink-950 text-ink-900 dark:text-paper-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-ink-900/10 dark:border-paper-100/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-ink-900/5 dark:hover:bg-paper-100/10">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display font-semibold truncate">{doc.title}</h1>
          <StatusBadge status={doc.status} />
          {doc.progress_stage && doc.status === "processing" && (
            <span className="text-xs text-ink-900/50 dark:text-paper-100/50">{doc.progress_stage}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowOriginal((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showOriginal ? "bg-violet-500/10 text-violet-600 dark:text-violet-300" : "hover:bg-ink-900/5 dark:hover:bg-paper-100/10"
            }`}
          >
            <Columns2 size={14} /> Original
          </button>
          <div className="relative">
            <button onClick={() => setExportOpen((o) => !o)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-ink-900/5 dark:hover:bg-paper-100/10">
              <Download size={14} /> Export <ChevronDown size={12} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-32 rounded-xl bg-white dark:bg-ink-800 border border-ink-900/10 dark:border-paper-100/10 shadow-lg overflow-hidden z-20">
                {["pdf", "docx", "md", "txt"].map((fmt) => (
                  <button key={fmt} onClick={() => handleExport(fmt)} className="w-full text-left px-3.5 py-2 text-xs hover:bg-ink-900/5 dark:hover:bg-paper-100/10 uppercase">
                    {fmt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Pages column */}
        <aside className="w-48 shrink-0 border-r border-ink-900/10 dark:border-paper-100/10 overflow-y-auto thin-scroll p-3 space-y-2">
          {doc.pages.map((p) => (
            <button
              key={p.id}
              onClick={() => { setActivePageId(p.id); setEditing(false); }}
              className={`w-full text-left rounded-lg overflow-hidden border transition-colors ${
                p.id === activePageId ? "border-violet-500" : "border-ink-900/10 dark:border-paper-100/10 hover:border-violet-300"
              }`}
            >
              {p.original_image_url && (
                <img src={`${import.meta.env.VITE_API_URL}${p.original_image_url}`} className="w-full h-20 object-cover bg-ink-900/5" />
              )}
              <div className="p-2 flex items-center justify-between">
                <span className="text-xs font-medium">Page {p.page_number}</span>
                <StatusBadge status={p.status} />
              </div>
            </button>
          ))}
        </aside>

        {/* Notes column */}
        <section className="flex-1 min-w-0 grid" style={{ gridTemplateColumns: showOriginal ? "1fr 1fr" : "1fr" }}>
          {showOriginal && activePage?.original_image_url && (
            <div className="border-r border-ink-900/10 dark:border-paper-100/10 overflow-y-auto thin-scroll p-4 bg-ink-900/[0.02] dark:bg-black/20">
              <img src={`${import.meta.env.VITE_API_URL}${activePage.original_image_url}`} className="w-full rounded-lg shadow" />
            </div>
          )}
          <div className="overflow-y-auto thin-scroll p-6 relative">
            {activePage?.status === "failed" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-bad-500/10 text-bad-500 text-sm mb-4">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{activePage.error_message || "This page failed to process."}</span>
              </div>
            )}
            {activePage && !["ready", "failed"].includes(activePage.status) && (
              <div className="flex items-center gap-2 text-sm text-ink-900/50 dark:text-paper-100/50 mb-4">
                <Loader2 size={14} className="animate-spin" /> Working on this page…
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wide text-ink-900/40 dark:text-paper-100/40">Digital notes</span>
              {activePage?.status === "ready" && (
                editing ? (
                  <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-300">
                    <Save size={13} /> {saving ? "Saving…" : "Save"}
                  </button>
                ) : (
                  <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-medium text-ink-900/50 dark:text-paper-100/50 hover:text-violet-600">
                    <Pencil size={13} /> Edit
                  </button>
                )
              )}
            </div>

            {editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full h-[60vh] p-3 rounded-lg border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-900 font-mono text-sm outline-none focus:border-violet-500"
              />
            ) : (
              <div ref={notesRef} onMouseUp={handleMouseUp} className="prose-notes select-text">
                {activePage?.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {activePage.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm text-ink-900/40 dark:text-paper-100/40">
                    {activePage?.status === "failed" ? "No content could be generated for this page." : "Notes will appear here once processing finishes."}
                  </p>
                )}
              </div>
            )}

            {selection && !editing && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
                <div className="relative">
                  <button
                    onClick={() => setExplainMenuOpen((o) => !o)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-violet-500 text-white text-sm font-medium shadow-xl hover:bg-violet-600"
                  >
                    <Sparkles size={14} /> Explain this topic
                  </button>
                  {explainMenuOpen && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 rounded-xl bg-white dark:bg-ink-800 border border-ink-900/10 dark:border-paper-100/10 shadow-xl overflow-hidden">
                      {EXPLAIN_MODES.map((m) => (
                        <button key={m.v} onClick={() => runExplain(m.v)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-900/5 dark:hover:bg-paper-100/10">
                          {m.l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(explaining || explanation) && (
              <div className="mt-6 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-violet-600 dark:text-violet-300 flex items-center gap-1.5 uppercase tracking-wide">
                    <Sparkles size={13} /> Explanation
                  </span>
                  <button onClick={() => setExplanation(null)} className="text-xs text-ink-900/40 dark:text-paper-100/40 hover:text-ink-900 dark:hover:text-paper-100">Dismiss</button>
                </div>
                {explaining ? (
                  <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-300 py-2">
                    <Loader2 size={16} className="animate-spin" /> Generating explanation…
                  </div>
                ) : (
                  explanation && <MarkdownRenderer content={explanation} />
                )}
              </div>
            )}
          </div>
        </section>

        {/* AI assistant column */}
        <aside className="w-80 shrink-0 border-l border-ink-900/10 dark:border-paper-100/10">
          {id && <AiPanel documentId={id} />}
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search, Trash2, Pencil, Files, Languages as LanguagesIcon } from "lucide-react";
import toast from "react-hot-toast";
import { AppShell } from "../components/AppShell";
import { UploadModal } from "../components/UploadModal";
import { StatusBadge } from "../components/Common";
import { listDocuments, getStats, deleteDocument, renameDocument, apiErrorMessage, type DocumentOut, type StatsOut } from "../lib/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentOut[]>([]);
  const [stats, setStats] = useState<StatsOut | null>(null);
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([listDocuments(query ? { q: query } : undefined), getStats()]);
      setDocs(d);
      setStats(s);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    // Poll while anything is still processing, so status updates live.
    const hasActive = docs.some((d) => d.status === "processing" || d.status === "pending");
    if (!hasActive) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this document permanently?")) return;
    try {
      await deleteDocument(id);
      toast.success("Document deleted.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function commitRename(id: string) {
    try {
      await renameDocument(id, renameValue);
      setRenamingId(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell onNewDocument={() => setShowUpload(true)}>
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="font-display text-3xl font-semibold mb-1">Your documents</h1>
        <p className="text-ink-900/60 dark:text-paper-100/60 mb-8">Everything you've converted, in one place.</p>

        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard icon={FileText} label="Documents" value={stats.total_documents} />
            <StatCard icon={Files} label="Pages processed" value={stats.total_pages} />
            <StatCard icon={LanguagesIcon} label="Languages used" value={stats.languages_used.length} />
          </div>
        )}

        <div className="relative mb-6">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-900/40 dark:text-paper-100/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by title…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-900 focus:border-violet-500 outline-none text-sm"
          />
        </div>

        {loading && docs.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-ink-900/5 dark:bg-paper-100/5 animate-pulse" />)}
          </div>
        ) : docs.length === 0 ? (
          <EmptyState onUpload={() => setShowUpload(true)} />
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => renamingId !== doc.id && navigate(`/documents/${doc.id}`)}
                className="group flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-white dark:bg-ink-900 border border-ink-900/10 dark:border-paper-100/10 hover:border-violet-400 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-violet-500" />
                  </div>
                  <div className="min-w-0">
                    {renamingId === doc.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commitRename(doc.id)}
                        onBlur={() => commitRename(doc.id)}
                        className="text-sm font-medium bg-transparent border-b border-violet-500 outline-none"
                      />
                    ) : (
                      <p className="font-medium truncate">{doc.title}</p>
                    )}
                    <p className="text-xs text-ink-900/50 dark:text-paper-100/50">
                      {doc.page_count} page{doc.page_count !== 1 ? "s" : ""} · {doc.language.toUpperCase()} · {new Date(doc.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <StatusBadge status={doc.status} />
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenamingId(doc.id); setRenameValue(doc.title); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-ink-900/5 dark:hover:bg-paper-100/10 transition-opacity"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-bad-500/10 text-bad-500 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={(id) => { setShowUpload(false); navigate(`/documents/${id}`); }}
        />
      )}
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="p-5 rounded-xl bg-white dark:bg-ink-900 border border-ink-900/10 dark:border-paper-100/10">
      <Icon size={18} className="text-violet-500 mb-3" />
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-ink-900/50 dark:text-paper-100/50">{label}</p>
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="text-center py-20 rounded-2xl border-2 border-dashed border-ink-900/15 dark:border-paper-100/15">
      <FileText size={32} className="mx-auto mb-3 text-ink-900/30 dark:text-paper-100/30" />
      <p className="font-medium mb-1">No documents yet</p>
      <p className="text-sm text-ink-900/50 dark:text-paper-100/50 mb-5">Upload your first handwritten page to get started.</p>
      <button onClick={onUpload} className="px-5 py-2.5 rounded-full bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors">
        Upload notes
      </button>
    </div>
  );
}

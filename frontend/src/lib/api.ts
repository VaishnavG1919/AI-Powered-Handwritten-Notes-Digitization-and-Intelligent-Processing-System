import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hwn_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (err.code === "ERR_NETWORK") return "Can't reach the server. Is the backend running?";
    return err.message || "Something went wrong.";
  }
  return "Something went wrong.";
}

// ---------- Types ----------

export interface UserOut {
  id: string;
  name: string;
  email: string;
}

export interface PageOut {
  id: string;
  page_number: number;
  status: "pending" | "preprocessing" | "ocr" | "cleanup" | "ready" | "failed";
  error_message: string | null;
  original_image_url: string | null;
  raw_ocr_text: string | null;
  ocr_confidence: number | null;
  content: string;
  equations: { raw: string; latex: string }[] | null;
  tables: { rows: string[][] }[] | null;
}

export interface DocumentOut {
  id: string;
  title: string;
  language: string;
  status: "pending" | "processing" | "ready" | "failed";
  progress_stage: string | null;
  error_message: string | null;
  page_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetailOut extends DocumentOut {
  pages: PageOut[];
}

export interface StatsOut {
  total_documents: number;
  total_pages: number;
  languages_used: string[];
  recent_documents: DocumentOut[];
}

// ---------- Auth ----------

export async function register(name: string, email: string, password: string) {
  const { data } = await api.post("/api/auth/register", { name, email, password });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post("/api/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<UserOut> {
  const { data } = await api.get("/api/auth/me");
  return data;
}

// ---------- Documents ----------

export async function uploadDocument(files: File[], title: string, language: string) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("title", title);
  form.append("language", language);
  const { data } = await api.post<DocumentDetailOut>("/api/documents", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listDocuments(params?: { q?: string; language?: string; status_filter?: string }) {
  const { data } = await api.get<DocumentOut[]>("/api/documents", { params });
  return data;
}

export async function getDocument(id: string) {
  const { data } = await api.get<DocumentDetailOut>(`/api/documents/${id}`);
  return data;
}

export async function renameDocument(id: string, title: string) {
  const { data } = await api.patch<DocumentOut>(`/api/documents/${id}`, { title });
  return data;
}

export async function deleteDocument(id: string) {
  await api.delete(`/api/documents/${id}`);
}

export async function getStats() {
  const { data } = await api.get<StatsOut>("/api/documents/stats");
  return data;
}

export async function downloadExport(id: string, fmt: string, filename: string) {
  const { data } = await api.get(`/api/documents/${id}/export`, { params: { fmt }, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ---------- Pages ----------

export async function updatePage(pageId: string, edited_markdown: string) {
  const { data } = await api.patch<PageOut>(`/api/pages/${pageId}`, { edited_markdown });
  return data;
}

// ---------- AI ----------

export async function explainTopic(documentId: string, text: string, mode: string) {
  const { data } = await api.post(`/api/ai/documents/${documentId}/explain`, { text, mode });
  return data.explanation as string;
}

export async function askNotes(documentId: string, question: string) {
  const { data } = await api.post(`/api/ai/documents/${documentId}/ask`, { question });
  return data.answer as string;
}

export async function summarizeNotes(documentId: string, style: string) {
  const { data } = await api.post(`/api/ai/documents/${documentId}/summarize`, { style });
  return data.summary as string;
}

export async function generateQuestions(
  documentId: string,
  question_types: string[],
  count: number,
  difficulty: string
) {
  const { data } = await api.post(`/api/ai/documents/${documentId}/questions`, {
    question_types,
    count,
    difficulty,
  });
  return data.questions as any[];
}

export async function explainEquation(latex: string, raw?: string) {
  const { data } = await api.post(`/api/ai/equations/explain`, { latex, raw });
  return data.explanation as string;
}

import { useState } from "react";
import {
  Send,
  Sparkles,
  FileQuestion,
  NotebookText,
  Loader2,
  Copy,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { askNotes, summarizeNotes, generateQuestions, apiErrorMessage } from "../lib/api";
import { MarkdownRenderer } from "./MarkdownRenderer";

type Tab = "ask" | "summarize" | "questions";

export function AiPanel({ documentId }: { documentId: string }) {
  const [tab, setTab] = useState<Tab>("ask");

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-ink-900/10 dark:border-paper-100/10 shrink-0 bg-white/50 dark:bg-ink-900/50 backdrop-blur-sm">
        <TabButton active={tab === "ask"} onClick={() => setTab("ask")} icon={Sparkles} label="Ask AI" />
        <TabButton active={tab === "summarize"} onClick={() => setTab("summarize")} icon={NotebookText} label="Summarize" />
        <TabButton active={tab === "questions"} onClick={() => setTab("questions")} icon={FileQuestion} label="Practice Quiz" />
      </div>
      <div className="flex-1 overflow-y-auto thin-scroll">
        {tab === "ask" && <AskTab documentId={documentId} />}
        {tab === "summarize" && <SummarizeTab documentId={documentId} />}
        {tab === "questions" && <QuestionsTab documentId={documentId} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium border-b-2 transition-all ${
        active
          ? "border-violet-500 text-violet-600 dark:text-violet-300 font-semibold"
          : "border-transparent text-ink-900/50 dark:text-paper-100/50 hover:text-ink-900 dark:hover:text-paper-100"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function AskTab({ documentId }: { documentId: string }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function send() {
    if (!question.trim()) return;
    const q = question;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    try {
      const answer = await askNotes(documentId, q);
      setMessages((m) => [...m, { role: "ai", text: answer }]);
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Answer copied to clipboard!");
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-3.5">
        {messages.length === 0 && (
          <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 text-xs text-ink-900/70 dark:text-paper-100/70 space-y-2">
            <p className="font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
              <Sparkles size={14} /> Ask anything about your notes
            </p>
            <p>Try asking:</p>
            <ul className="list-disc pl-4 space-y-1 text-ink-900/60 dark:text-paper-100/60">
              <li>"What are the main formulas on page 1?"</li>
              <li>"Summarize the key theorem"</li>
              <li>"Explain the steps in the derivation"</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl px-3.5 py-3 ${
              m.role === "user"
                ? "bg-violet-500/10 text-ink-900 dark:text-paper-100 ml-6 text-sm"
                : "bg-ink-900/[0.03] dark:bg-paper-100/[0.05] border border-ink-900/10 dark:border-paper-100/10 mr-1"
            }`}
          >
            {m.role === "user" ? (
              <div className="font-medium">{m.text}</div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-ink-900/5 dark:border-paper-100/5">
                  <span className="text-[11px] font-semibold tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1 uppercase">
                    <Sparkles size={12} /> AI Answer
                  </span>
                  <button
                    onClick={() => handleCopy(m.text, i)}
                    className="p-1 rounded text-ink-900/40 dark:text-paper-100/40 hover:text-violet-600 transition-colors"
                    title="Copy answer"
                  >
                    {copiedIndex === i ? <Check size={12} className="text-good-500" /> : <Copy size={12} />}
                  </button>
                </div>
                <MarkdownRenderer content={m.text} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-ink-900/5 dark:bg-paper-100/5 text-xs text-violet-600 dark:text-violet-300">
            <Loader2 size={15} className="animate-spin" /> Thinking and reviewing notes…
          </div>
        )}
      </div>
      <div className="p-3 border-t border-ink-900/10 dark:border-paper-100/10 flex gap-2 bg-white/40 dark:bg-ink-900/40 backdrop-blur-sm">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask your notes…"
          className="flex-1 px-3 py-2 rounded-lg border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-800 text-sm outline-none focus:border-violet-500"
        />
        <button
          onClick={send}
          disabled={loading || !question.trim()}
          className="px-3.5 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function SummarizeTab({ documentId }: { documentId: string }) {
  const [style, setStyle] = useState("short");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const styleOptions = [
    { v: "short", l: "Short", desc: "Key highlights" },
    { v: "detailed", l: "Detailed", desc: "All major topics" },
    { v: "exam_revision", l: "Exam revision", desc: "Bullet-point cheat sheet" },
  ];

  async function run() {
    setLoading(true);
    setResult("");
    try {
      const s = await summarizeNotes(documentId, style);
      setResult(s);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Summary copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-xs font-semibold text-ink-900/70 dark:text-paper-100/70 block mb-2">
          Summary Style
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {styleOptions.map((o) => (
            <button
              key={o.v}
              onClick={() => setStyle(o.v)}
              className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-center ${
                style === o.v
                  ? "bg-violet-500 text-white shadow-sm font-semibold"
                  : "bg-ink-900/5 dark:bg-paper-100/10 text-ink-900/70 dark:text-paper-100/70 hover:bg-ink-900/10"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Generating structured summary…
          </>
        ) : (
          <>
            <Sparkles size={14} /> Generate summary
          </>
        )}
      </button>

      {result && (
        <div className="rounded-xl border border-ink-900/10 dark:border-paper-100/10 bg-white dark:bg-ink-900/70 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-ink-900/10 dark:border-paper-100/10 bg-ink-900/[0.02] dark:bg-paper-100/[0.03]">
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
              <NotebookText size={14} />
              {styleOptions.find((o) => o.v === style)?.l} Summary
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-ink-900/60 dark:text-paper-100/60 hover:text-violet-600 hover:bg-ink-900/5 dark:hover:bg-paper-100/10 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-good-500" /> Copied
                </>
              ) : (
                <>
                  <Copy size={13} /> Copy
                </>
              )}
            </button>
          </div>
          <div className="p-4">
            <MarkdownRenderer content={result} />
          </div>
        </div>
      )}
    </div>
  );
}

interface QuestionItem {
  type: string;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
}

function QuestionsTab({ documentId }: { documentId: string }) {
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [types, setTypes] = useState<string[]>(["mcq"]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number | string>>({});

  function toggleType(t: string) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function run() {
    if (types.length === 0) {
      toast.error("Pick at least one question type.");
      return;
    }
    setLoading(true);
    setRevealed({});
    setSelectedAnswers({});
    try {
      const qs = await generateQuestions(documentId, types, count, difficulty);
      setQuestions(qs);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function toggleReveal(index: number) {
    setRevealed((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function toggleRevealAll() {
    const allRevealed = questions.length > 0 && questions.every((_, i) => revealed[i]);
    const nextState: Record<number, boolean> = {};
    questions.forEach((_, i) => {
      nextState[i] = !allRevealed;
    });
    setRevealed(nextState);
  }

  function resetQuiz() {
    setSelectedAnswers({});
    setRevealed({});
    toast.success("Practice quiz reset. Good luck!");
  }

  function selectOption(qIndex: number, optionIndex: number) {
    if (revealed[qIndex]) return; // locked once revealed
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }));
  }

  function isCorrectOption(optionText: string, optionIndex: number, answerText: string): boolean {
    if (!answerText) return false;
    const cleanAns = answerText.trim().toLowerCase();
    const cleanOpt = optionText.trim().toLowerCase();
    const letter = String.fromCharCode(65 + optionIndex).toLowerCase();

    return (
      cleanAns === cleanOpt ||
      cleanAns === letter ||
      cleanAns.startsWith(`${letter}.`) ||
      cleanAns.startsWith(`${letter})`) ||
      cleanAns.startsWith(`${letter}:`) ||
      cleanAns.startsWith(cleanOpt) ||
      cleanOpt.startsWith(cleanAns)
    );
  }

  const allRevealed = questions.length > 0 && questions.every((_, i) => revealed[i]);
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-xs font-semibold text-ink-900/70 dark:text-paper-100/70 block mb-2">
          Question Types
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "mcq", label: "MCQ" },
            { id: "short_answer", label: "Short answer" },
            { id: "long_answer", label: "Long answer" },
            { id: "viva", label: "Viva / Oral" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => toggleType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                types.includes(t.id)
                  ? "bg-violet-500 text-white shadow-sm font-semibold"
                  : "bg-ink-900/5 dark:bg-paper-100/10 text-ink-900/70 dark:text-paper-100/70 hover:bg-ink-900/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-ink-900/70 dark:text-paper-100/70 block mb-1">
            Difficulty
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-800 text-xs font-medium outline-none focus:border-violet-500"
          >
            <option value="easy">Easy (Definitions)</option>
            <option value="medium">Medium (Concepts)</option>
            <option value="hard">Hard (Advanced)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-900/70 dark:text-paper-100/70 block mb-1">
            Count
          </label>
          <input
            type="number"
            min={1}
            max={15}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(15, Number(e.target.value))))}
            className="w-full px-2.5 py-1.5 rounded-lg border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-800 text-xs font-medium outline-none focus:border-violet-500"
          />
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Generating test questions…
          </>
        ) : (
          <>
            <FileQuestion size={14} /> Generate practice questions
          </>
        )}
      </button>

      {questions.length > 0 && (
        <div className="space-y-3 pt-2">
          {/* Top toolbar */}
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-semibold text-ink-900/80 dark:text-paper-100/80">
              {questions.length} Questions {answeredCount > 0 && `• ${answeredCount} answered`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={resetQuiz}
                className="flex items-center gap-1 text-[11px] font-medium text-ink-900/50 dark:text-paper-100/50 hover:text-violet-600 transition-colors"
                title="Reset answers to practice again"
              >
                <RotateCcw size={12} /> Reset
              </button>
              <button
                onClick={toggleRevealAll}
                className="flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-300 hover:underline"
              >
                {allRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                {allRevealed ? "Hide all" : "Reveal all"}
              </button>
            </div>
          </div>

          {/* Question cards */}
          {questions.map((q, i) => {
            const isRevealed = Boolean(revealed[i]);
            const selectedOpt = selectedAnswers[i];
            const hasOptions = Array.isArray(q.options) && q.options.length > 0;

            return (
              <div
                key={i}
                className={`rounded-xl border transition-all ${
                  isRevealed
                    ? "border-violet-500/30 bg-violet-500/[0.02] dark:bg-violet-500/[0.04]"
                    : "border-ink-900/10 dark:border-paper-100/10 bg-white dark:bg-ink-900/60"
                } p-3.5 shadow-sm space-y-2.5`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-violet-500 text-white font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-ink-900/5 dark:bg-paper-100/10 text-ink-900/60 dark:text-paper-100/60">
                      {q.type?.replace("_", " ") || "question"}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleReveal(i)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      isRevealed
                        ? "bg-violet-500/10 text-violet-600 dark:text-violet-300"
                        : "bg-ink-900/5 dark:bg-paper-100/10 text-ink-900/70 dark:text-paper-100/70 hover:bg-violet-500/10 hover:text-violet-600"
                    }`}
                  >
                    {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                    {isRevealed ? "Hide Answer" : "Show Answer"}
                  </button>
                </div>

                {/* Question body */}
                <div className="font-medium text-ink-950 dark:text-paper-50 text-sm">
                  <MarkdownRenderer content={q.question} />
                </div>

                {/* MCQ Options */}
                {hasOptions && (
                  <div className="space-y-1.5 pt-1">
                    {q.options!.map((opt: string, optIndex: number) => {
                      const letter = String.fromCharCode(65 + optIndex);
                      const isSelected = selectedOpt === optIndex;
                      const isCorrect = isCorrectOption(opt, optIndex, q.answer);

                      let btnStyle = "border-ink-900/10 dark:border-paper-100/10 bg-ink-900/[0.02] dark:bg-paper-100/[0.03] text-ink-900/80 dark:text-paper-100/80 hover:border-violet-400";
                      let badgeStyle = "bg-ink-900/10 dark:bg-paper-100/10 text-ink-900/70 dark:text-paper-100/70";

                      if (isRevealed) {
                        if (isCorrect) {
                          btnStyle = "border-good-500 bg-good-500/15 text-good-700 dark:text-good-300 font-semibold";
                          badgeStyle = "bg-good-500 text-white font-bold";
                        } else if (isSelected && !isCorrect) {
                          btnStyle = "border-bad-500 bg-bad-500/15 text-bad-700 dark:text-bad-300";
                          badgeStyle = "bg-bad-500 text-white font-bold";
                        } else {
                          btnStyle = "opacity-50 border-ink-900/5 dark:border-paper-100/5";
                        }
                      } else if (isSelected) {
                        btnStyle = "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium ring-1 ring-violet-500/30";
                        badgeStyle = "bg-violet-500 text-white font-bold";
                      }

                      return (
                        <button
                          key={optIndex}
                          onClick={() => selectOption(i, optIndex)}
                          disabled={isRevealed}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${btnStyle}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[11px] shrink-0 ${badgeStyle}`}>
                              {letter}
                            </span>
                            <span className="truncate">{opt}</span>
                          </div>
                          {isRevealed && isCorrect && <CheckCircle2 size={15} className="text-good-500 shrink-0" />}
                          {isRevealed && isSelected && !isCorrect && <XCircle size={15} className="text-bad-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Revealed Answer Panel */}
                {isRevealed && (
                  <div className="pt-2 border-t border-ink-900/10 dark:border-paper-100/10 space-y-2">
                    <div className="p-3 rounded-lg bg-good-500/10 border border-good-500/30 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-good-600 dark:text-good-400">
                        <CheckCircle2 size={14} /> Correct Answer:
                      </div>
                      <div className="text-xs text-ink-900/90 dark:text-paper-100/90 pl-5">
                        <MarkdownRenderer content={q.answer} />
                      </div>
                    </div>

                    {q.explanation && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400 text-[11px]">
                          <HelpCircle size={13} /> Explanation:
                        </div>
                        <div className="text-ink-900/80 dark:text-paper-100/80 pl-4">
                          <MarkdownRenderer content={q.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  UploadCloud, Sparkles, Sigma, Table2, Search, MessageSquareText,
  Languages, FileDown, ArrowRight, Moon, Sun,
} from "lucide-react";
import { Logo } from "../components/Common";
import { useTheme } from "../lib/ThemeContext";

const FEATURES = [
  { icon: UploadCloud, title: "Multi-page upload", desc: "Drop in photos or a whole scanned PDF — pages stay in order automatically." },
  { icon: Sparkles, title: "Mistral AI cleanup", desc: "Raw OCR gets corrected, structured, and titled without losing your meaning." },
  { icon: Sigma, title: "Equations rendered", desc: "Handwritten math becomes real LaTeX you can copy or ask Mistral to explain." },
  { icon: Table2, title: "Editable tables", desc: "Handwritten tables become real, editable digital tables." },
  { icon: Search, title: "Search everything", desc: "Find any line across every page of every document, instantly." },
  { icon: MessageSquareText, title: "Ask your notes", desc: "Chat with an assistant that only answers from what you actually wrote." },
  { icon: Languages, title: "Multiple languages", desc: "English, Hindi, Telugu, Tamil, Kannada, and more." },
  { icon: FileDown, title: "Export anywhere", desc: "Send finished notes out as PDF, Word, Markdown, or plain text." },
];

const STEPS = [
  { n: "01", title: "Upload", desc: "Photograph or scan your handwritten pages, or drop in a PDF." },
  { n: "02", title: "Read & clean", desc: "Mistral AI reads the handwriting and fixes spelling, spacing, and structure." },
  { n: "03", title: "Study", desc: "Edit, search, ask questions, summarize, and generate practice questions." },
];

export default function Landing() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-paper-50 text-ink-900 dark:bg-ink-950 dark:text-paper-100 transition-colors">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-ink-900/10 dark:border-paper-100/15 hover:bg-ink-900/5 dark:hover:bg-paper-100/5 transition-colors"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to="/login" className="text-sm font-medium px-4 py-2 hover:opacity-70 transition-opacity">
            Log in
          </Link>
          <Link
            to="/register"
            className="text-sm font-medium px-4 py-2 rounded-full bg-violet-500 text-white hover:bg-violet-600 transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero — signature element: a scribble that draws itself, then morphs into type */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block font-mono text-xs tracking-wider uppercase text-violet-600 dark:text-violet-300 mb-5">
            Handwriting → Digital Notes
          </span>
          <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight">
            Your handwriting,
            <br />
            <span className="italic text-violet-600 dark:text-violet-300">finally readable.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-900/70 dark:text-paper-100/70 max-w-md leading-relaxed">
            Upload a photo of your notes. Mistral AI reads the handwriting, fixes the OCR
            mess, and hands you back clean, structured, editable notes — equations,
            tables, and all.
          </p>
          <div className="mt-9 flex items-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors"
            >
              <UploadCloud size={18} />
              Upload your first page
            </Link>
            <a href="#how" className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-violet-600 transition-colors">
              See how it works <ArrowRight size={14} />
            </a>
          </div>
        </div>

        <div className="relative aspect-[4/3] rounded-2xl paper-grain dark:ink-grain bg-paper-100 dark:bg-ink-900 border border-ink-900/10 dark:border-paper-100/10 overflow-hidden flex items-center justify-center p-8">
          <ScribbleToText />
        </div>
      </section>

      {/* How it works — a real 3-step sequence, so numbering earns its place */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-20 border-t border-ink-900/10 dark:border-paper-100/10">
        <h2 className="font-display text-3xl font-semibold mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-10">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div className="font-mono text-sm text-violet-500 mb-3">{s.n}</div>
              <h3 className="font-display text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-ink-900/65 dark:text-paper-100/65 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-ink-900/10 dark:border-paper-100/10">
        <h2 className="font-display text-3xl font-semibold mb-12">Everything you need to study from your own notes</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-ink-900/10 dark:bg-paper-100/10 rounded-2xl overflow-hidden">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-paper-50 dark:bg-ink-950 p-6 hover:bg-paper-100 dark:hover:bg-ink-900 transition-colors">
              <f.icon size={20} className="text-violet-500 mb-4" />
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-ink-900/60 dark:text-paper-100/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-ink-900/10 dark:border-paper-100/10 text-center">
        <h2 className="font-display text-4xl font-semibold mb-6">Stop retyping your own notes.</h2>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors"
        >
          Create a free account <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-ink-900/10 dark:border-paper-100/10 flex items-center justify-between text-sm text-ink-900/50 dark:text-paper-100/50">
        <Logo />
        <span>Built for students. Powered by Mistral AI.</span>
      </footer>
    </div>
  );
}

function ScribbleToText() {
  return (
    <div className="relative w-full h-full">
      <motion.svg viewBox="0 0 320 200" className="absolute inset-0 w-full h-full" fill="none">
        <motion.path
          d="M20 150 Q 40 60, 80 100 T 150 90 Q 180 60 210 110 T 290 70"
          stroke="var(--color-amber-500)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: [1, 1, 0] }}
          transition={{ duration: 2.2, times: [0, 0.7, 1], repeat: Infinity, repeatDelay: 1.4 }}
        />
      </motion.svg>
      <motion.div
        className="absolute inset-0 flex flex-col justify-center gap-3 px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: 3.6, times: [0, 0.55, 0.65, 0.9, 1], repeat: Infinity }}
      >
        <div className="h-3 w-3/4 rounded bg-violet-400/70" />
        <div className="h-3 w-full rounded bg-ink-900/15 dark:bg-paper-100/20" />
        <div className="h-3 w-5/6 rounded bg-ink-900/15 dark:bg-paper-100/20" />
        <div className="h-3 w-2/3 rounded bg-ink-900/15 dark:bg-paper-100/20" />
      </motion.div>
    </div>
  );
}

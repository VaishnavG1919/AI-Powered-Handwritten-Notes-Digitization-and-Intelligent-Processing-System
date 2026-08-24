import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Strips accidental triple-backtick code fences (e.g. ```markdown ... ```)
 * that LLMs sometimes wrap around their markdown output.
 */
function cleanMarkdownText(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();

  // If the model wrapped the entire text in a markdown code block
  if (text.startsWith("```markdown") && text.endsWith("```")) {
    text = text.slice(11, -3).trim();
  } else if (text.startsWith("```md") && text.endsWith("```")) {
    text = text.slice(5, -3).trim();
  } else if (text.startsWith("```") && text.endsWith("```") && text.length > 6) {
    text = text.slice(3, -3).trim();
  }

  return text;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const cleanedContent = cleanMarkdownText(content);

  return (
    <div className={`prose-ai text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ node, ...props }) => (
            <h1
              className="text-base font-bold text-ink-950 dark:text-paper-50 mt-4 mb-2 pb-1.5 border-b-2 border-violet-500/30 flex items-center gap-2"
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="text-sm font-bold text-violet-700 dark:text-violet-300 mt-4 mb-2 pl-3 border-l-4 border-violet-500 bg-violet-500/10 dark:bg-violet-500/15 py-1.5 rounded-r-lg shadow-2xs"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mt-3 mb-1.5 pl-2 border-l-2 border-amber-500 bg-amber-500/10 py-1 rounded-r"
              {...props}
            />
          ),
          h4: ({ node, ...props }) => (
            <h4
              className="text-xs font-semibold text-ink-900 dark:text-paper-100 mt-2.5 mb-1 underline decoration-violet-400 decoration-2 underline-offset-2"
              {...props}
            />
          ),
          h5: ({ node, ...props }) => (
            <h5 className="text-xs font-semibold text-ink-800 dark:text-paper-200 mt-2 mb-1" {...props} />
          ),
          h6: ({ node, ...props }) => (
            <h6 className="text-xs font-medium text-ink-700 dark:text-paper-300 mt-2 mb-1" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="my-2 text-ink-900/90 dark:text-paper-100/90 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-2.5 space-y-1.5 pl-5 list-disc marker:text-violet-500 marker:text-sm" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-2.5 space-y-1.5 pl-5 list-decimal marker:text-violet-600 dark:marker:text-violet-400 font-semibold" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-ink-900/90 dark:text-paper-100/90 pl-1 leading-relaxed" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-ink-950 dark:text-paper-50 bg-violet-500/15 dark:bg-violet-400/20 px-1 py-0.5 rounded text-[0.95em]" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-ink-900 dark:text-paper-100 font-medium" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-3 border-t border-ink-900/10 dark:border-paper-100/10" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="my-2.5 pl-3.5 py-1.5 border-l-3 border-violet-400 bg-violet-500/5 dark:bg-violet-500/10 text-xs italic text-ink-900/80 dark:text-paper-100/80 rounded-r-md"
              {...props}
            />
          ),
          code: ({ node, className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="font-mono text-xs bg-ink-900/10 dark:bg-paper-100/10 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-medium"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="my-2.5 p-3 rounded-lg bg-ink-950 text-paper-100 font-mono text-xs overflow-x-auto thin-scroll">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 thin-scroll rounded-lg border border-ink-900/10 dark:border-paper-100/10 shadow-2xs">
              <table className="min-w-full divide-y divide-ink-900/10 dark:divide-paper-100/10 text-xs text-left" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 bg-ink-900/5 dark:bg-paper-100/5 font-semibold text-ink-950 dark:text-paper-50" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 border-t border-ink-900/5 dark:border-paper-100/5 text-ink-900/80 dark:text-paper-100/80" {...props} />
          ),
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    </div>
  );
}

import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Moon, Sun, Plus } from "lucide-react";
import { Logo } from "./Common";
import { useAuth } from "../lib/AuthContext";
import { useTheme } from "../lib/ThemeContext";

export function AppShell({ children, onNewDocument }: { children: ReactNode; onNewDocument?: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-paper-50 dark:bg-ink-950 text-ink-900 dark:text-paper-100 flex">
      <aside className="w-60 shrink-0 border-r border-ink-900/10 dark:border-paper-100/10 flex flex-col p-4">
        <Link to="/dashboard" className="mb-8 px-2"><Logo /></Link>

        <button
          onClick={() => (onNewDocument ? onNewDocument() : navigate("/dashboard"))}
          className="w-full mb-6 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors"
        >
          <Plus size={16} /> New document
        </button>

        <nav className="flex-1 space-y-1">
          <Link
            to="/dashboard"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === "/dashboard"
                ? "bg-violet-500/10 text-violet-600 dark:text-violet-300"
                : "hover:bg-ink-900/5 dark:hover:bg-paper-100/5"
            }`}
          >
            <LayoutDashboard size={16} /> Documents
          </Link>
        </nav>

        <div className="pt-4 border-t border-ink-900/10 dark:border-paper-100/10 space-y-1">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium hover:bg-ink-900/5 dark:hover:bg-paper-100/5 transition-colors"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="px-3 py-2 text-xs text-ink-900/50 dark:text-paper-100/50 truncate">{user?.email}</div>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-bad-500 hover:bg-bad-500/10 transition-colors"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

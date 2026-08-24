import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Logo } from "../components/Common";
import { useAuth } from "../lib/AuthContext";
import { apiErrorMessage } from "../lib/api";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50 dark:bg-ink-950 text-ink-900 dark:text-paper-100 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/"><Logo className="mb-10 justify-center" /></Link>
        <h1 className="font-display text-2xl font-semibold text-center mb-1">Create your account</h1>
        <p className="text-center text-sm text-ink-900/60 dark:text-paper-100/60 mb-8">Start converting your notes</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <input
              required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-900 focus:border-violet-500 outline-none transition-colors"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-900 focus:border-violet-500 outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-ink-900/15 dark:border-paper-100/15 bg-white dark:bg-ink-900 focus:border-violet-500 outline-none transition-colors"
              placeholder="At least 8 characters"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm mt-6 text-ink-900/60 dark:text-paper-100/60">
          Already have an account? <Link to="/login" className="text-violet-600 dark:text-violet-300 font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}

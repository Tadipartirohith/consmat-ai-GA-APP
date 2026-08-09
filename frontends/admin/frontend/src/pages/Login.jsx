import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HardHat, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@consmat.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (res.ok) {
      toast.success("Signed in", { description: `Welcome back, ${res.user?.name || "Admin"}`, duration: 1500 });
      navigate("/admin", { replace: true });
    } else {
      setError(res.error);
      toast.error("Login failed", { description: res.error });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cm-bg px-4 cm-grain">
      {/* ambient accent glow */}
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-cm-accent/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-cm-accent/5 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-cm-accent">
            <HardHat size={22} className="text-black" />
          </div>
          <div className="leading-tight">
            <div className="font-heading text-xl font-700 tracking-tight text-cm-text">ConsMat</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-cm-muted">Admin Console</div>
          </div>
        </div>

        <div className="rounded-lg border border-cm-border bg-cm-panel p-6 md:p-7">
          <h1 className="font-heading text-2xl font-600 tracking-tight text-cm-text">Sign in</h1>
          <p className="mt-1 text-sm text-cm-muted">Construction materials marketplace operations.</p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="login-form">
            <div>
              <label className="mb-1.5 block text-xs font-500 uppercase tracking-wide text-cm-muted">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cm-muted" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  className="border-cm-border bg-cm-bg pl-9 text-cm-text placeholder:text-cm-muted focus-visible:ring-cm-accent"
                  placeholder="admin@consmat.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-500 uppercase tracking-wide text-cm-muted">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cm-muted" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  className="border-cm-border bg-cm-bg pl-9 text-cm-text placeholder:text-cm-muted focus-visible:ring-cm-accent"
                  placeholder="••••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-cm-accent px-4 py-2.5 text-sm font-600 text-black transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign in to console"}
            </button>
          </form>

          <div className="mt-5 rounded-md border border-cm-border bg-cm-bg/60 px-3 py-2.5 text-xs text-cm-muted">
            <span className="font-500 text-cm-text">Demo:</span> admin@consmat.com · password <span className="font-mono text-cm-accent">consmat123</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

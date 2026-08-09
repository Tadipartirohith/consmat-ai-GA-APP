import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Truck, LockKey, EnvelopeSimple, Warning, CircleNotch } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("operator@consmat.in");
  const [password, setPassword] = useState("consmat123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      toast.success(`Signed in as ${user.name || user.role}`);
      navigate("/operator", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Login failed. Check your credentials.";
      setError(typeof msg === "string" ? msg : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0f1216]">
      {/* top bar */}
      <div className="border-b border-white/10 px-5 py-4 flex items-center gap-2">
        <div className="h-7 w-7 bg-[#ff7a2f] flex items-center justify-center">
          <Truck size={17} weight="fill" className="text-[#0f1216]" />
        </div>
        <span className="font-head font-extrabold tracking-tight text-white text-lg">
          CONSMAT<span className="text-[#ff7a2f]">.</span>OPS
        </span>
      </div>

      <div className="flex-1 flex items-center md:justify-start justify-center px-5 py-10 md:px-16">
        <div className="w-full max-w-md animate-fade-up">
          <p className="font-mono text-xs text-[#ff7a2f] tracking-widest mb-3">
            // OPERATOR CONSOLE
          </p>
          <h1 className="font-head font-extrabold tracking-tight text-white text-4xl sm:text-5xl leading-[1.05] mb-2">
            Dispatch<br />command center
          </h1>
          <p className="text-white/50 text-sm mb-8 max-w-sm">
            Sign in to manage the consolidated multi-vendor dispatch queue and live
            network stock.
          </p>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="font-mono text-[11px] tracking-wider text-white/50 uppercase">
                Email
              </label>
              <div className="mt-1.5 flex items-center gap-2 bg-[#171c22] border border-white/10 px-3 focus-within:border-[#ff7a2f] transition-colors">
                <EnvelopeSimple size={16} className="text-white/40" />
                <input
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/30"
                  placeholder="operator@consmat.in"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-[11px] tracking-wider text-white/50 uppercase">
                Password
              </label>
              <div className="mt-1.5 flex items-center gap-2 bg-[#171c22] border border-white/10 px-3 focus-within:border-[#ff7a2f] transition-colors">
                <LockKey size={16} className="text-white/40" />
                <input
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/30 font-mono"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div
                data-testid="login-error"
                className="flex items-center gap-2 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              >
                <Warning size={15} weight="fill" /> {error}
              </div>
            )}

            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff7a2f] text-[#0f1216] font-head font-bold text-sm tracking-wide py-3.5 flex items-center justify-center gap-2 hover:bg-[#ff8c4d] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a2f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1216]"
            >
              {loading ? (
                <>
                  <CircleNotch size={16} className="animate-spin" /> AUTHENTICATING…
                </>
              ) : (
                "SIGN IN"
              )}
            </button>
          </form>

          <div className="mt-6 border border-white/10 bg-[#171c22] px-4 py-3">
            <p className="font-mono text-[11px] text-white/40 leading-relaxed">
              DEMO · <span className="text-white/70">operator@consmat.in</span> ·
              password <span className="text-[#ff7a2f]">consmat123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

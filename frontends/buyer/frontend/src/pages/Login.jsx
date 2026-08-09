import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login as apiLogin } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, Boxes } from "lucide-react";
import { toast } from "sonner";

const LOGIN_BG =
  "https://images.unsplash.com/photo-1644221150167-fb4fafa7f411?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHw0fHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwbW9kZXJufGVufDB8fHx8MTc4NjIyMTMyMHww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { authenticate } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("buyer@consmat.com");
  const [password, setPassword] = useState("consmat123");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      authenticate(data);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Login failed. Check credentials or backend URL.";
      toast.error(typeof msg === "string" ? msg : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left visual */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src={LOGIN_BG} alt="Construction site" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1216] via-[#0f1216]/70 to-[#0f1216]/40" />
        <div className="absolute bottom-0 left-0 p-12">
          <h1 className="font-head max-w-md text-4xl font-black leading-tight tracking-tighter lg:text-5xl">
            Procurement, <span className="text-[#ff7a2f]">optimized.</span>
          </h1>
          <p className="mt-4 max-w-sm text-white/60">
            Compare landed prices, split sourcing, and order construction materials across Hyderabad
            — all in one place.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff7a2f]">
              <Boxes size={24} className="text-black" />
            </div>
            <div>
              <p className="font-head text-xl font-black tracking-tight">Consmat AI</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Buyer Portal</p>
            </div>
          </div>

          <h2 className="font-head text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-white/50">Use your buyer account to continue.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs uppercase tracking-[0.15em] text-white/50">
                Email
              </Label>
              <Input
                id="email"
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 border-white/10 bg-[#171c22] h-11"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs uppercase tracking-[0.15em] text-white/50">
                Password
              </Label>
              <Input
                id="password"
                data-testid="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 border-white/10 bg-[#171c22] h-11"
                required
              />
            </div>
            <Button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822]"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight size={18} className="ml-1.5" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 rounded-lg border border-white/10 bg-[#171c22] p-3 text-xs text-white/40">
            Demo password: <span className="font-mono text-[#ff7a2f]">consmat123</span>
          </p>
        </div>
      </div>
    </div>
  );
}

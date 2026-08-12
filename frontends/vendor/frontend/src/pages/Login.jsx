import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import ApiConfigDialog from "@/components/ApiConfigDialog";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("vendor@consmat.com");
  const [password, setPassword] = useState("consmat123");
  const [loading, setLoading] = useState(false);
  const apiConfigured = !!getApiBase();

  const submit = async (e) => {
    e.preventDefault();
    if (!apiConfigured) {
      toast.error("Set the backend API URL first (top-right API button).");
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role && user.role !== "vendor") {
        toast.error(`This app is for vendors. Your role: ${user.role}`);
      }
      toast.success("Signed in");
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1216] px-4">
      <div className="absolute right-4 top-4">
        <ApiConfigDialog />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-start">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#ff7a2f]/15 text-[#ff7a2f]">
            <Store size={22} />
          </div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white">
            Vendor<span className="text-[#ff7a2f]">Hub</span>
          </h1>
          <p className="mt-1 text-sm text-[#94a3b8]">Sign in to your seller console</p>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#171c22] p-6">
          {!apiConfigured && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-[#ff7a2f]/30 bg-[#ff7a2f]/10 p-3 text-xs text-[#ff7a2f]" data-testid="api-not-configured-banner">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>Backend URL not set. Tap the <b>API</b> button (top-right) to configure it.</span>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[#94a3b8]">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                placeholder="vendor@consmat.com"
                className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[#94a3b8]">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
                placeholder="••••••••"
                className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full bg-[#ff7a2f] font-semibold text-[#0f1216] hover:brightness-110"
            >
              {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              Sign In
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-[#94a3b8]">
            Demo: <span className="text-[#ff7a2f]">vendor@consmat.com</span> / <span className="text-[#ff7a2f]">consmat123</span>
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-[#94a3b8]">
          New vendor?{" "}
          <Link to="/register" data-testid="go-to-register-link" className="font-semibold text-[#ff7a2f] hover:underline">
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

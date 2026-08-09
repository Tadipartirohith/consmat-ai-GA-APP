import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { registerVendor, getApiBase } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ApiConfigDialog from "@/components/ApiConfigDialog";
import { toast } from "sonner";

const FIELDS = [
  { key: "name", label: "Business Name", type: "text", required: true, placeholder: "Sharma General Store" },
  { key: "email", label: "Email", type: "email", required: true, placeholder: "vendor@example.com" },
  { key: "password", label: "Password", type: "password", required: true, placeholder: "consmat123" },
  { key: "phone", label: "Phone", type: "tel", required: false, placeholder: "+91 98765 43210" },
  { key: "category", label: "Category / Business Type", type: "text", required: false, placeholder: "Groceries" },
  { key: "location", label: "Location", type: "text", required: false, placeholder: "Mumbai, MH" },
];

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const apiConfigured = !!getApiBase();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!apiConfigured) {
      toast.error("Set the backend API URL first (API button, top-right).");
      return;
    }
    setLoading(true);
    try {
      await registerVendor(form);
      toast.success("Vendor registered! Signing you in…");
      try {
        await login(form.email, form.password);
        navigate("/");
      } catch {
        navigate("/login");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1216] px-4 py-10">
      <div className="absolute right-4 top-4">
        <ApiConfigDialog />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Link to="/login" data-testid="back-to-login-link" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-white">
          <ArrowLeft size={15} /> Back to login
        </Link>

        <div className="mb-6 flex flex-col items-start">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#ff7a2f]/15 text-[#ff7a2f]">
            <Store size={22} />
          </div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white">Vendor Onboarding</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">Register your business to start selling</p>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#171c22] p-6">
          {!apiConfigured && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-[#ff7a2f]/30 bg-[#ff7a2f]/10 p-3 text-xs text-[#ff7a2f]" data-testid="api-not-configured-banner">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>Backend URL not set. Tap the <b>API</b> button (top-right) to configure it.</span>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="text-[#94a3b8]">
                  {f.label}{f.required && <span className="text-[#ff7a2f]"> *</span>}
                </Label>
                <Input
                  id={f.key}
                  type={f.type}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={form[f.key] || ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  data-testid={`register-${f.key}-input`}
                  className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-[#94a3b8]">Description</Label>
              <Textarea
                id="description"
                placeholder="Tell customers about your business…"
                value={form.description || ""}
                onChange={(e) => set("description", e.target.value)}
                data-testid="register-description-input"
                className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              data-testid="register-submit-btn"
              className="w-full bg-[#ff7a2f] font-semibold text-[#0f1216] hover:brightness-110"
            >
              {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              Register Vendor
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

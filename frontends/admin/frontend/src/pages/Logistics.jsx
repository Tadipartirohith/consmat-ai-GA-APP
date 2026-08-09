import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Save, RotateCcw, Truck } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const prettify = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bKm\b/, "(km)").replace(/\bCod\b/, "COD");

const CURRENCY_HINT = /(fee|value|threshold|rate)/i;

export default function Logistics() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);

  const configQ = useQuery({ queryKey: ["logistics"], queryFn: async () => (await api.get("/admin/logistics-config")).data });

  useEffect(() => {
    if (configQ.data && !form) setForm({ ...configQ.data });
  }, [configQ.data, form]);

  const save = useMutation({
    mutationFn: async (payload) => (await api.put("/admin/logistics-config", payload)).data,
    onSuccess: (data) => {
      setForm({ ...data });
      qc.setQueryData(["logistics"], data);
      toast.success("Logistics rules saved", { description: "Configuration updated successfully." });
    },
    onError: (e) => toast.error("Save failed", { description: apiErrorMessage(e) }),
  });

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => configQ.data && setForm({ ...configQ.data });

  const dirty = form && configQ.data && JSON.stringify(form) !== JSON.stringify(configQ.data);

  if (configQ.isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-24 text-cm-muted">
        {configQ.isError ? "Failed to load logistics config." : <Loader2 className="animate-spin" size={22} />}
      </div>
    );
  }

  const entries = Object.entries(form);
  const toggles = entries.filter(([, v]) => typeof v === "boolean");
  const fields = entries.filter(([, v]) => typeof v !== "boolean");

  return (
    <div className="mx-auto max-w-3xl">
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
        data-testid="logistics-form"
        className="overflow-hidden rounded-lg border border-cm-border bg-cm-panel"
      >
        <div className="flex items-center gap-3 border-b border-cm-border px-6 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-cm-accent/15 text-cm-accent">
            <Truck size={19} />
          </div>
          <div>
            <h2 className="font-heading text-base font-600 text-cm-text">Delivery & Logistics Rules</h2>
            <p className="text-xs text-cm-muted">Fields rendered dynamically from the API response.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-6 py-6 sm:grid-cols-2">
          {fields.map(([key, value]) => {
            const isNumber = typeof value === "number";
            const currency = isNumber && CURRENCY_HINT.test(key);
            return (
              <div key={key} className={key === "default_dispatch_hub" ? "sm:col-span-2" : ""}>
                <label className="mb-1.5 block text-xs font-500 uppercase tracking-wide text-cm-muted">{prettify(key)}</label>
                <div className="relative">
                  {currency && (
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-cm-muted">₹</span>
                  )}
                  <Input
                    type={isNumber ? "number" : "text"}
                    step="any"
                    value={value}
                    onChange={(e) => setField(key, isNumber ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                    data-testid={`logistics-field-${key}`}
                    className={`border-cm-border bg-cm-bg text-cm-text focus-visible:ring-cm-accent ${currency ? "pl-7" : ""}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {toggles.length > 0 && (
          <div className="space-y-3 border-t border-cm-border px-6 py-5">
            {toggles.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-md border border-cm-border bg-cm-bg px-4 py-3">
                <span className="text-sm font-500 text-cm-text">{prettify(key)}</span>
                <Switch
                  checked={value}
                  onCheckedChange={(v) => setField(key, v)}
                  data-testid={`logistics-toggle-${key}`}
                  className="data-[state=checked]:bg-cm-accent"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-cm-border bg-cm-panel2/40 px-6 py-4">
          <button
            type="button"
            onClick={reset}
            disabled={!dirty || save.isPending}
            data-testid="logistics-reset-button"
            className="inline-flex items-center gap-2 rounded-md border border-cm-border px-4 py-2 text-sm font-500 text-cm-muted transition-colors hover:text-cm-text disabled:opacity-40"
          >
            <RotateCcw size={15} /> Reset
          </button>
          <button
            type="submit"
            disabled={!dirty || save.isPending}
            data-testid="logistics-save-button"
            className="inline-flex items-center gap-2 rounded-md bg-cm-accent px-5 py-2 text-sm font-600 text-black transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

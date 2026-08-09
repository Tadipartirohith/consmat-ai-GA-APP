import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";

const EMPTY = { name: "", category: "", city: "", phone: "", tier: "Trader", approved: true };
const TIERS = ["Trader", "Distributor", "Stockist", "Wholesaler"];

export function AddVendorDialog({ open, onOpenChange, onSubmit, submitting }) {
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit({
      name: form.name.trim(),
      category: form.category.trim() || "General",
      city: form.city.trim(),
      phone: form.phone.trim(),
      tier: form.tier,
      approved: form.approved,
    });
  };

  const handleOpenChange = (o) => {
    if (!o) setForm(EMPTY);
    onOpenChange(o);
  };

  const field = "w-full rounded-md border border-cm-border bg-cm-panel2 px-3 py-2 text-sm text-cm-text placeholder:text-cm-muted focus:border-cm-accent focus:outline-none";
  const lbl = "mb-1 block text-[11px] uppercase tracking-wide text-cm-muted";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-cm-border bg-cm-panel text-cm-text">
        <DialogHeader>
          <DialogTitle>Add a vendor</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" data-testid="add-vendor-form">
          <div>
            <label className={lbl}>Vendor name *</label>
            <input
              autoFocus
              required
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Sri Balaji Traders"
              data-testid="add-vendor-name"
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Category</label>
              <input value={form.category} onChange={set("category")} placeholder="Cement" data-testid="add-vendor-category" className={field} />
            </div>
            <div>
              <label className={lbl}>City</label>
              <input value={form.city} onChange={set("city")} placeholder="Medchal" data-testid="add-vendor-city" className={field} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Phone</label>
              <input value={form.phone} onChange={set("phone")} placeholder="+91 …" data-testid="add-vendor-phone" className={field} />
            </div>
            <div>
              <label className={lbl}>Tier</label>
              <select value={form.tier} onChange={set("tier")} data-testid="add-vendor-tier" className={field}>
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 pt-1 text-sm text-cm-muted">
            <input
              type="checkbox"
              checked={form.approved}
              onChange={(e) => setForm((f) => ({ ...f, approved: e.target.checked }))}
              data-testid="add-vendor-approved"
              className="h-4 w-4 accent-cm-accent"
            />
            Approve immediately (skip KYC pending)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="rounded-md border border-cm-border px-4 py-2 text-sm text-cm-muted transition-colors hover:text-cm-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.name.trim()}
              data-testid="add-vendor-submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-cm-accent px-4 py-2 text-sm font-600 text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add vendor
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { LifeBuoy, Plus, Trash2, X, Send, CheckCircle2, Loader2, Package, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const SEV = {
  low: "bg-white/10 text-cm-muted",
  medium: "bg-sky-500/15 text-sky-300",
  high: "bg-amber-500/15 text-amber-400",
  critical: "bg-red-500/15 text-red-300",
};
const STATUS = {
  open: "bg-cm-accent/15 text-cm-accent",
  in_progress: "bg-sky-500/15 text-sky-300",
  escalated: "bg-amber-500/15 text-amber-400",
  resolved: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-white/10 text-cm-muted",
};
const lbl = (s) => (s || "").replace(/_/g, " ");

export default function Support() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState(null);

  const metricsQ = useQuery({ queryKey: ["support-metrics"], queryFn: async () => (await api.get("/support/metrics")).data });
  const listQ = useQuery({ queryKey: ["complaints"], queryFn: async () => (await api.get("/support/complaints")).data.complaints });
  const m = metricsQ.data;
  const list = (listQ.data || []).filter((c) => filter === "all" || c.status === filter);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["complaints"] });
    qc.invalidateQueries({ queryKey: ["support-metrics"] });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Total issues" value={m?.total} tone="text-cm-text" />
        <Metric label="Open" value={m?.open} tone="text-cm-accent" />
        <Metric label="Ongoing" value={m?.ongoing} tone="text-sky-300" />
        <Metric label="Closed" value={m?.closed} tone="text-emerald-400" />
      </div>
      {m && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-cm-muted">By criticality:</span>
          {["critical", "high", "medium", "low"].map((s) => (
            <span key={s} className={`rounded px-2 py-0.5 font-500 capitalize ${SEV[s]}`}>
              {s}: {m.by_severity?.[s] || 0}
            </span>
          ))}
          <span className="text-cm-muted">·</span>
          <span className="rounded px-2 py-0.5 font-500 capitalize bg-amber-500/15 text-amber-400">
            at admin: {m.by_level?.admin || 0}
          </span>
        </div>
      )}

      <StaffPanel />

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {["all", "open", "in_progress", "escalated", "resolved", "closed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-xs font-500 capitalize transition-colors ${
              filter === f ? "border-cm-accent bg-cm-accent/10 text-cm-accent" : "border-cm-border text-cm-muted hover:bg-cm-panel2"
            }`}
          >
            {lbl(f)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-lg border border-cm-border bg-cm-panel">
        {listQ.isLoading ? (
          <p className="py-12 text-center text-cm-muted"><Loader2 className="mx-auto animate-spin" size={20} /></p>
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-sm text-cm-muted">No complaints in this view.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-cm-border text-left text-xs uppercase tracking-wide text-cm-muted">
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Raised by</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Level</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className="cursor-pointer border-b border-cm-border/60 transition-colors last:border-0 hover:bg-cm-panel2/50"
                  data-testid={`admin-complaint-${c.id}`}
                >
                  <td className="px-5 py-3 font-mono text-cm-accent">{c.id}</td>
                  <td className="px-5 py-3 text-cm-text">{c.subject}</td>
                  <td className="px-5 py-3 text-cm-muted">{c.raised_by?.name} <span className="text-cm-muted/60">({c.raised_by?.role})</span></td>
                  <td className="px-5 py-3 text-cm-muted">{c.order_id || "—"}</td>
                  <td className="px-5 py-3"><span className={`rounded px-2 py-0.5 text-xs font-500 capitalize ${SEV[c.severity]}`}>{c.severity}</span></td>
                  <td className="px-5 py-3 capitalize text-cm-muted">{c.level}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-500 capitalize ${STATUS[c.status]}`}>{lbl(c.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {active && <Detail id={active} onClose={() => setActive(null)} onChanged={refresh} />}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-cm-border bg-cm-panel p-4">
      <p className={`font-mono text-2xl font-700 ${tone}`}>{value ?? "—"}</p>
      <p className="mt-1 text-xs text-cm-muted">{label}</p>
    </div>
  );
}

function Detail({ id, onClose, onChanged }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const cQ = useQuery({ queryKey: ["complaint", id], queryFn: async () => (await api.get(`/support/complaints/${id}`)).data });
  const c = cQ.data;
  const after = () => {
    qc.invalidateQueries({ queryKey: ["complaint", id] });
    onChanged?.();
  };
  const msg = useMutation({
    mutationFn: async (n) => (await api.post(`/support/complaints/${id}/messages`, { note: n })).data,
    onSuccess: () => { setNote(""); after(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const status = useMutation({
    mutationFn: async (s) => (await api.post(`/support/complaints/${id}/status`, { status: s })).data,
    onSuccess: (_d, s) => { toast.success(`Marked ${s}`); after(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const done = c && ["resolved", "closed"].includes(c.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-lg border border-cm-border bg-cm-panel p-5 text-cm-text" onClick={(e) => e.stopPropagation()}>
        {c && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-sm text-cm-accent">{c.id}</span>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-600 capitalize ${STATUS[c.status]}`}>{lbl(c.status)}</span>
                <button onClick={onClose} className="text-cm-muted hover:text-cm-text"><X size={18} /></button>
              </div>
            </div>
            <h3 className="font-heading text-lg font-700">{c.subject}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-cm-muted">
              <span className={`rounded px-1.5 py-0.5 font-600 capitalize ${SEV[c.severity]}`}>{c.severity}</span>
              <span>Level: {c.level}</span>
              <span>· {c.raised_by?.role}: {c.raised_by?.name}</span>
            </div>
            {c.level === "admin" && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-400">
                <ShieldAlert size={13} /> Escalated to admin.
              </div>
            )}
            {c.order_snapshot && (
              <div className="mt-3 rounded-md border border-cm-border bg-cm-bg p-3 text-xs text-cm-muted">
                <p className="mb-1 font-600 text-cm-text flex items-center gap-1"><Package size={12} /> Order {c.order_snapshot.order_id} · {lbl(c.order_snapshot.status)}</p>
                <p>Buyer: {c.order_snapshot.buyer?.name} · {c.order_snapshot.buyer?.phone}</p>
                <p>Vendors: {(c.order_snapshot.vendors || []).join(", ")}</p>
                <p>Total: ₹{Number(c.order_snapshot.total || 0).toLocaleString("en-IN")}</p>
              </div>
            )}
            <div className="mt-3 space-y-2">
              {(c.thread || []).map((t, i) => (
                <div key={i} className="rounded-md border border-cm-border bg-cm-bg p-2.5">
                  <div className="mb-0.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-cm-muted">
                    <span>{t.by} · {t.role}</span>
                    <span>{t.at ? new Date(t.at).toLocaleString() : ""}</span>
                  </div>
                  <p className="text-sm text-cm-text">{t.note}</p>
                </div>
              ))}
            </div>
            {!done && (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && note.trim() && msg.mutate(note.trim())}
                    placeholder="Add a note…"
                    className="flex-1 rounded-md border border-cm-border bg-cm-bg px-3 py-2 text-sm text-cm-text outline-none placeholder:text-cm-muted"
                  />
                  <button onClick={() => note.trim() && msg.mutate(note.trim())} className="rounded-md bg-cm-accent p-2 text-black">
                    {msg.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => status.mutate("resolved")} className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-600 text-emerald-400 hover:bg-emerald-500/20">
                    <CheckCircle2 size={14} /> Resolve
                  </button>
                  <button onClick={() => status.mutate("closed")} className="rounded-md border border-cm-border px-3 py-1.5 text-xs text-cm-muted hover:text-cm-text">
                    Close
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StaffPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", role: "operator" });
  const staffQ = useQuery({ queryKey: ["staff"], queryFn: async () => (await api.get("/admin/staff")).data });
  const add = useMutation({
    mutationFn: async (b) => (await api.post("/admin/staff", b)).data,
    onSuccess: (d) => { toast.success(`${d.role} added`); setForm({ name: "", email: "", role: "operator" }); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const del = useMutation({
    mutationFn: async (email) => (await api.delete(`/admin/staff/${encodeURIComponent(email)}`)).data,
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const inp = "rounded-md border border-cm-border bg-cm-bg px-2.5 py-1.5 text-xs text-cm-text outline-none placeholder:text-cm-muted";

  return (
    <div className="rounded-lg border border-cm-border bg-cm-panel p-4">
      <h2 className="mb-3 font-heading text-sm font-700 text-cm-text">Operations team</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {(staffQ.data || []).map((s) => (
          <span key={s.email} className="flex items-center gap-1.5 rounded-md border border-cm-border bg-cm-bg px-2.5 py-1 text-xs text-cm-muted">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-600 uppercase ${s.role === "manager" ? "bg-amber-500/15 text-amber-400" : "bg-sky-500/15 text-sky-300"}`}>{s.role}</span>
            {s.name} <span className="text-cm-muted/60">{s.email}</span>
            <button onClick={() => del.mutate(s.email)} className="text-cm-muted/60 hover:text-red-400"><Trash2 size={12} /></button>
          </span>
        ))}
        {(staffQ.data || []).length === 0 && <span className="text-xs text-cm-muted">No operators or managers yet.</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className={inp} data-testid="staff-name" />
        <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@consmat.com" className={inp} data-testid="staff-email" />
        <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={inp} data-testid="staff-role">
          <option value="operator">Operator</option>
          <option value="manager">Manager</option>
        </select>
        <button
          onClick={() => form.name.trim() && form.email.trim() && add.mutate(form)}
          data-testid="add-staff-btn"
          className="flex items-center gap-1 rounded-md bg-cm-accent px-3 py-1.5 text-xs font-600 text-black"
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

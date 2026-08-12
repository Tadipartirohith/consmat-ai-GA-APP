import { useEffect, useState, useCallback } from "react";
import {
  Lifebuoy, ArrowBendUpRight, CheckCircle, PaperPlaneRight, CircleNotch, Plus, Trash,
  UsersThree, Warning, X, Package,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const SEV = {
  low: "bg-white/10 text-white/70",
  medium: "bg-sky-500/15 text-sky-300",
  high: "bg-[#f59e0b]/15 text-[#f59e0b]",
  critical: "bg-red-500/15 text-red-300",
};
const STATUS = {
  open: "bg-[#ff7a2f]/15 text-[#ff7a2f]",
  in_progress: "bg-sky-500/15 text-sky-300",
  escalated: "bg-[#f59e0b]/15 text-[#f59e0b]",
  resolved: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-white/10 text-white/50",
};
const lbl = (s) => (s || "").replace(/_/g, " ");
const FILTERS = ["all", "open", "in_progress", "escalated", "resolved"];

export default function SupportDesk() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const [metrics, setMetrics] = useState(null);
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState(null);

  const load = useCallback(() => {
    api.complaints().then((d) => setList(d.complaints || [])).catch(() => setList([]));
    api.supportMetrics().then(setMetrics).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  const shown = (list || []).filter((c) => filter === "all" || c.status === filter);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl font-extrabold tracking-tight text-white">Customer Support</h1>
          <p className="text-xs text-white/45">
            Complaints from buyers and vendors. {isManager ? "Escalations land with you." : "Escalate to a manager if needed."}
          </p>
        </div>
        {metrics && (
          <div className="flex gap-2">
            <Stat label="Open" value={metrics.open} tone="text-[#ff7a2f]" />
            <Stat label="Ongoing" value={metrics.ongoing} tone="text-sky-300" />
            <Stat label="Closed" value={metrics.closed} tone="text-emerald-400" />
          </div>
        )}
      </div>

      {isManager && <TeamPanel />}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              filter === f ? "border-[#ff7a2f] bg-[#ff7a2f]/10 text-[#ff7a2f]" : "border-white/10 text-white/50 hover:bg-white/5"
            }`}
          >
            {lbl(f)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list === null ? (
          <p className="col-span-full py-10 text-center text-white/40">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="col-span-full border border-dashed border-white/10 bg-[#171c22] py-12 text-center text-sm text-white/40">
            No complaints in this view.
          </p>
        ) : (
          shown.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              data-testid={`support-row-${c.id}`}
              className="border border-white/10 bg-[#171c22] p-4 text-left transition-colors hover:border-[#ff7a2f]/40"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-xs text-[#ff7a2f]">{c.id}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS[c.status]}`}>{lbl(c.status)}</span>
              </div>
              <p className="truncate font-semibold text-white">{c.subject}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${SEV[c.severity]}`}>{c.severity}</span>
                <span>{c.raised_by?.role}: {c.raised_by?.name}</span>
                {c.order_id && <span className="flex items-center gap-1"><Package size={11} /> {c.order_id}</span>}
                <span>· at {c.level}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {active && <Detail id={active} role={user?.role} onClose={() => setActive(null)} onChanged={load} />}
    </>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="border border-white/10 bg-[#171c22] px-3 py-2 text-center">
      <p className={`font-mono text-lg font-bold ${tone}`}>{value ?? 0}</p>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}

function Detail({ id, role, onClose, onChanged }) {
  const [c, setC] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => api.complaint(id).then(setC).catch(() => {}), [id]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = async (fn, ok) => {
    setBusy(true);
    try {
      const updated = await fn();
      setC(updated);
      onChanged?.();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (!c) return null;
  const canEscalate =
    (role === "operator" && c.level === "operator") || (role === "manager" && c.level === "manager");
  const escTo = role === "operator" ? "manager" : "admin";
  const done = ["resolved", "closed"].includes(c.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto border border-white/10 bg-[#171c22] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-sm text-[#ff7a2f]">{c.id}</span>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS[c.status]}`}>{lbl(c.status)}</span>
            <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
          </div>
        </div>
        <h3 className="font-head text-lg font-bold">{c.subject}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
          <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${SEV[c.severity]}`}>{c.severity}</span>
          <span>Handling level: {c.level}</span>
          <span>· {c.raised_by?.role}: {c.raised_by?.name} ({c.raised_by?.email})</span>
        </div>

        {c.order_snapshot && (
          <div className="mt-3 border border-white/10 bg-[#0f1216] p-3 text-xs text-white/70">
            <p className="mb-1 font-semibold text-white">Order {c.order_snapshot.order_id} · {lbl(c.order_snapshot.status)}</p>
            <p>Buyer: {c.order_snapshot.buyer?.name} · {c.order_snapshot.buyer?.phone}</p>
            <p>Address: {c.order_snapshot.address}</p>
            <p>Vendors: {(c.order_snapshot.vendors || []).join(", ")}</p>
            <p>Total: ₹{Number(c.order_snapshot.total || 0).toLocaleString("en-IN")}</p>
            <div className="mt-1 space-y-0.5">
              {(c.order_snapshot.items || []).map((it, i) => (
                <p key={i} className="text-white/50">{it.name} · {it.quantity} {it.unit} · {it.vendor}</p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {(c.thread || []).map((m, i) => (
            <div key={i} className="border border-white/10 bg-[#0f1216] p-2.5">
              <div className="mb-0.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40">
                <span>{m.by} · {m.role}</span>
                <span>{m.at ? new Date(m.at).toLocaleString() : ""}</span>
              </div>
              <p className="text-sm text-white/80">{m.note}</p>
            </div>
          ))}
        </div>

        {!done && (
          <div className="mt-3 flex items-center gap-2">
            <input
              data-testid="support-reply-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && note.trim() && act(() => api.complaintMessage(id, note.trim()).then((r) => (setNote(""), r)))}
              placeholder="Reply to the complainant…"
              className="flex-1 border border-white/10 bg-[#0f1216] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
            />
            <button
              onClick={() => note.trim() && act(() => api.complaintMessage(id, note.trim()).then((r) => (setNote(""), r)))}
              disabled={busy}
              className="bg-[#ff7a2f] p-2 text-[#0f1216]"
            >
              {busy ? <CircleNotch size={16} className="animate-spin" /> : <PaperPlaneRight size={16} />}
            </button>
          </div>
        )}

        {!done && (
          <div className="mt-3 flex flex-wrap gap-2">
            {c.status === "open" && (
              <button
                data-testid="support-take-btn"
                onClick={() => act(() => api.complaintStatus(id, "in_progress"), "Marked in progress")}
                className="border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
              >
                Take up
              </button>
            )}
            {canEscalate && (
              <button
                data-testid="support-escalate-btn"
                onClick={() => act(() => api.complaintEscalate(id, `Escalated after review.`), `Escalated to ${escTo}`)}
                className="flex items-center gap-1.5 border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-1.5 text-xs font-semibold text-[#f59e0b] hover:bg-[#f59e0b]/20"
              >
                <ArrowBendUpRight size={14} /> Escalate to {escTo}
              </button>
            )}
            <button
              data-testid="support-resolve-btn"
              onClick={() => act(() => api.complaintStatus(id, "resolved", "Resolved."), "Resolved")}
              className="flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
            >
              <CheckCircle size={14} /> Resolve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamPanel() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.staff().then(setStaff).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setBusy(true);
    try {
      await api.addStaff({ name: form.name.trim(), email: form.email.trim(), role: "operator" });
      toast.success("Operator added");
      setForm({ name: "", email: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't add operator");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (email) => {
    try {
      await api.removeStaff(email);
      toast.success("Removed");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't remove");
    }
  };

  return (
    <div className="mb-5 border border-white/10 bg-[#171c22] p-4">
      <div className="mb-3 flex items-center gap-2">
        <UsersThree size={16} className="text-[#ff7a2f]" />
        <h2 className="font-head text-sm font-bold text-white">Your operators</h2>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {staff.filter((s) => s.role === "operator").length === 0 && (
          <span className="text-xs text-white/40">No operators yet.</span>
        )}
        {staff.filter((s) => s.role === "operator").map((s) => (
          <span key={s.email} className="flex items-center gap-1.5 border border-white/10 bg-[#0f1216] px-2.5 py-1 text-xs text-white/70">
            {s.name} <span className="text-white/40">{s.email}</span>
            <button onClick={() => remove(s.email)} className="text-white/30 hover:text-red-400"><Trash size={12} /></button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Operator name"
          className="border border-white/10 bg-[#0f1216] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/30"
        />
        <input
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="email@consmat.com"
          className="border border-white/10 bg-[#0f1216] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/30"
        />
        <button onClick={add} disabled={busy} className="flex items-center gap-1 bg-[#ff7a2f] px-3 py-1.5 text-xs font-semibold text-[#0f1216]">
          <Plus size={13} /> Add operator
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { getComplaints, getComplaint, addComplaintMessage } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LifeBuoy, Send, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

const SEV = { low: "bg-white/10 text-[#94a3b8]", medium: "bg-sky-500/15 text-sky-300", high: "bg-[#f59e0b]/15 text-[#f59e0b]", critical: "bg-red-500/15 text-red-300" };
const STATUS = { open: "bg-[#ff7a2f]/15 text-[#ff7a2f]", in_progress: "bg-sky-500/15 text-sky-300", escalated: "bg-[#f59e0b]/15 text-[#f59e0b]", resolved: "bg-emerald-500/15 text-emerald-400", closed: "bg-white/10 text-[#94a3b8]" };
const lbl = (s) => (s || "").replace(/_/g, " ");

export function SupportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} data-testid="vendor-support-btn" className="text-[#94a3b8] hover:bg-white/5 hover:text-white">
        <LifeBuoy size={16} className="mr-1.5" /> <span className="hidden sm:inline">Support</span>
      </Button>
      <SupportSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function SupportSheet({ open, onOpenChange }) {
  const [list, setList] = useState(null);
  const [active, setActive] = useState(null);
  const load = () => getComplaints().then((d) => setList(d.complaints || [])).catch(() => setList([]));
  useEffect(() => { if (open) load(); }, [open]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent data-testid="vendor-support-sheet" className="flex w-full flex-col border-white/10 bg-[#0f1216] text-white sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-heading flex items-center gap-2 text-xl text-white">
              <LifeBuoy size={20} className="text-[#ff7a2f]" /> Support & Complaints
            </SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-xs text-[#94a3b8]">Issues you raised and complaints about your orders. Use "Report an issue" on an order to raise a new one.</p>
          <div className="mt-3 flex-1 space-y-3 overflow-y-auto">
            {list === null ? (
              <p className="py-10 text-center text-sm text-[#94a3b8]">Loading…</p>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center text-[#94a3b8]">
                <LifeBuoy size={30} className="mb-3 opacity-40" />
                <p className="text-sm">No complaints yet.</p>
              </div>
            ) : (
              list.map((c) => (
                <button key={c.id} onClick={() => setActive(c.id)} data-testid={`vendor-complaint-row-${c.id}`} className="w-full rounded-xl border border-white/10 bg-[#171c22] p-4 text-left transition-colors hover:border-[#ff7a2f]/40">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-xs text-[#ff7a2f]">{c.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS[c.status]}`}>{lbl(c.status)}</span>
                  </div>
                  <p className="truncate font-semibold">{c.subject}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[#94a3b8]">
                    <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${SEV[c.severity]}`}>{c.severity}</span>
                    <span>by {c.raised_by?.role}</span>
                    {c.order_id && <span className="flex items-center gap-1"><Package size={11} /> {c.order_id}</span>}
                    <span>· at {c.level}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Detail id={active} onClose={() => setActive(null)} onChanged={load} />
    </>
  );
}

function Detail({ id, onClose, onChanged }) {
  const [c, setC] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!id) { setC(null); return; } getComplaint(id).then(setC).catch(() => setC(null)); }, [id]);
  const send = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try { const u = await addComplaintMessage(id, note.trim()); setC(u); setNote(""); onChanged?.(); }
    catch { toast.error("Couldn't send message."); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#171c22] text-white sm:max-w-md">
        {c && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center justify-between text-lg">
                <span className="font-mono text-[#ff7a2f]">{c.id}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS[c.status]}`}>{lbl(c.status)}</span>
              </DialogTitle>
            </DialogHeader>
            <p className="font-semibold">{c.subject}</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#94a3b8]">
              <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${SEV[c.severity]}`}>{c.severity}</span>
              <span>Handling: {c.level}</span>
              {c.order_id && <span>· Order {c.order_id}</span>}
            </div>
            {c.order_snapshot && (
              <div className="rounded-lg bg-black/25 p-3 text-xs text-[#94a3b8]">
                <p className="mb-1 font-semibold text-white">Order {c.order_snapshot.order_id}</p>
                <p>Buyer: {c.order_snapshot.buyer?.name}</p>
                <p>Total: ₹{Number(c.order_snapshot.total || 0).toLocaleString("en-IN")}</p>
              </div>
            )}
            <div className="space-y-2">
              {(c.thread || []).map((m, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-[#0f1216] p-2.5">
                  <div className="mb-0.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#94a3b8]">
                    <span>{m.by} · {m.role}</span>
                    <span>{m.at ? new Date(m.at).toLocaleString() : ""}</span>
                  </div>
                  <p className="text-sm text-white/90">{m.note}</p>
                </div>
              ))}
            </div>
            {!["resolved", "closed"].includes(c.status) && (
              <div className="flex items-center gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Add a message…" className="border-white/10 bg-[#0f1216]" />
                <Button onClick={send} disabled={busy} className="shrink-0 bg-[#ff7a2f] text-[#0f1216] hover:brightness-110">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

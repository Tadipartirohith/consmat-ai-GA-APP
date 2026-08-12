import React, { useState } from "react";
import { raiseComplaint } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SEVERITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];
const TARGETS = [
  { id: "", label: "General" },
  { id: "vendor", label: "Vendor / material" },
  { id: "delivery", label: "Delivery" },
  { id: "payment", label: "Payment" },
];

export function ComplaintDialog({ open, onOpenChange, orderId = null, onCreated }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [target, setTarget] = useState(orderId ? "vendor" : "");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setSubject("");
    setDescription("");
    setSeverity("medium");
    setTarget(orderId ? "vendor" : "");
  };

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error("Add a subject and a description.");
      return;
    }
    setBusy(true);
    try {
      const c = await raiseComplaint({
        order_id: orderId || undefined,
        subject: subject.trim(),
        description: description.trim(),
        severity,
        target: target || undefined,
      });
      toast.success(`Complaint ${c.id} raised`, { description: "Our support team will pick it up." });
      reset();
      onOpenChange(false);
      onCreated?.(c);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't raise the complaint.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-md border border-white/10 bg-[#0f1216] px-3 py-2 text-sm text-white focus:border-[#ff7a2f] focus:outline-none";
  const lbl = "mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/40";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : (reset(), onOpenChange(false)))}>
      <DialogContent data-testid="complaint-dialog" className="border-white/10 bg-[#171c22] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-head text-xl">
            <LifeBuoy size={18} className="text-[#ff7a2f]" />
            {orderId ? `Report an issue · ${orderId}` : "New support request"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Subject</label>
            <Input
              data-testid="complaint-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Short quantity received"
              className="border-white/10 bg-[#0f1216]"
            />
          </div>
          <div>
            <label className={lbl}>What went wrong?</label>
            <textarea
              data-testid="complaint-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the issue so support can help quickly."
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Severity</label>
              <select data-testid="complaint-severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className={field}>
                {SEVERITIES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>About</label>
              <select data-testid="complaint-target" value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
                {TARGETS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          {!orderId && (
            <p className="text-[11px] text-white/40">
              Not about a specific order. For order issues, use "Report an issue" on the order.
            </p>
          )}
          <Button
            data-testid="complaint-submit"
            onClick={submit}
            disabled={busy}
            className="w-full bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822]"
          >
            {busy ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <LifeBuoy size={16} className="mr-1.5" />}
            Submit complaint
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

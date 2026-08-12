import { useState } from "react";
import { raiseComplaint } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ComplaintDialog({ open, onOpenChange, orderId }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error("Add a subject and description.");
      return;
    }
    setBusy(true);
    try {
      const c = await raiseComplaint({
        order_id: orderId || undefined,
        subject: subject.trim(),
        description: description.trim(),
        severity,
        target: "delivery",
      });
      toast.success(`Complaint ${c.id} raised`, { description: "Support will follow up." });
      setSubject("");
      setDescription("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't raise the complaint.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-md border border-white/10 bg-[#0f1216] px-3 py-2 text-sm text-white focus:border-[#ff7a2f] focus:outline-none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#171c22] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <LifeBuoy size={18} className="text-[#ff7a2f]" /> Report an issue {orderId ? `· ${orderId}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="border-white/10 bg-[#0f1216]" data-testid="vendor-complaint-subject" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the issue…" className={field} data-testid="vendor-complaint-desc" />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={field}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <Button onClick={submit} disabled={busy} data-testid="vendor-complaint-submit" className="w-full bg-[#ff7a2f] font-semibold text-[#0f1216] hover:brightness-110">
            {busy ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <LifeBuoy size={15} className="mr-1.5" />}
            Submit complaint
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

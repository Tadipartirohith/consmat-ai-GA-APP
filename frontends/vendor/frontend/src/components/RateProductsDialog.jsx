import { useEffect, useState } from "react";
import { getMaterials, submitRating } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

export function RateProductsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        data-testid="rate-materials-btn"
        className="border-white/10 bg-[#0f1216] text-[#94a3b8] transition-colors hover:bg-white/5 hover:text-[#ff7a2f]"
      >
        <Star size={14} className="mr-1.5" /> Rate materials
      </Button>
      <RateProductsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function Stars({ value, onChange }) {
  const [h, setH] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onMouseEnter={() => setH(n)} onMouseLeave={() => setH(0)} onClick={() => onChange(n)}>
          <Star size={20} className={(h || value) >= n ? "fill-[#ff7a2f] text-[#ff7a2f]" : "text-white/25"} />
        </button>
      ))}
    </div>
  );
}

export function RateProductsDialog({ open, onOpenChange }) {
  const [mats, setMats] = useState([]);
  const [ratings, setRatings] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) getMaterials().then((m) => setMats(Array.isArray(m) ? m : [])).catch(() => setMats([]));
  }, [open]);

  const submit = async () => {
    const items = Object.entries(ratings).filter(([, s]) => s > 0);
    if (!items.length) {
      toast.error("Rate at least one product.");
      return;
    }
    setBusy(true);
    try {
      for (const [mid, stars] of items) {
        await submitRating({ kind: "product", target_id: mid, stars });
      }
      toast.success(`Rated ${items.length} product(s)`);
      setRatings({});
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't submit ratings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-[#171c22] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Star size={18} className="fill-[#ff7a2f] text-[#ff7a2f]" /> Rate materials
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-[#94a3b8]">Share how the materials you handle perform. Ratings feed the marketplace.</p>
        <div className="mt-3 space-y-2">
          {mats.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border border-white/10 bg-[#0f1216] p-2.5">
              <span className="flex items-center gap-2 text-sm"><Package size={14} className="text-[#94a3b8]" /> {m.name}</span>
              <Stars value={ratings[m.id] || 0} onChange={(s) => setRatings((r) => ({ ...r, [m.id]: s }))} />
            </div>
          ))}
        </div>
        <Button onClick={submit} disabled={busy} className="mt-3 w-full bg-[#ff7a2f] font-semibold text-[#0f1216] hover:brightness-110">
          {busy ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <Star size={15} className="mr-1.5" />} Submit ratings
        </Button>
      </DialogContent>
    </Dialog>
  );
}

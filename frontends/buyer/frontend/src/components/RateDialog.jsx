import React, { useState } from "react";
import { submitRating } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, Loader2, Store, Package } from "lucide-react";
import { titleCase } from "@/lib/format";
import { toast } from "sonner";

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110"
          aria-label={`${n} stars`}
        >
          <Star
            size={22}
            className={(hover || value) >= n ? "fill-[#ff7a2f] text-[#ff7a2f]" : "text-white/25"}
          />
        </button>
      ))}
    </div>
  );
}

// targets: [{ kind: "vendor"|"product", id, name }]
export function RateDialog({ open, onOpenChange, targets = [], orderId = null, onDone }) {
  const [ratings, setRatings] = useState({}); // key -> { stars, comment }
  const [busy, setBusy] = useState(false);
  const key = (t) => `${t.kind}:${t.id}`;

  const setStars = (t, stars) => setRatings((r) => ({ ...r, [key(t)]: { ...r[key(t)], stars } }));
  const setComment = (t, comment) => setRatings((r) => ({ ...r, [key(t)]: { ...r[key(t)], comment } }));

  const submit = async () => {
    const toSend = targets
      .map((t) => ({ t, r: ratings[key(t)] }))
      .filter((x) => x.r?.stars > 0);
    if (!toSend.length) {
      toast.error("Tap the stars to rate at least one.");
      return;
    }
    setBusy(true);
    try {
      for (const { t, r } of toSend) {
        await submitRating({ kind: t.kind, target_id: t.id, stars: r.stars, comment: r.comment || "", order_id: orderId || undefined });
      }
      toast.success(`Thanks! ${toSend.length} rating(s) submitted.`);
      setRatings({});
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't submit ratings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="rate-dialog" className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#171c22] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-head text-xl">
            <Star size={18} className="fill-[#ff7a2f] text-[#ff7a2f]" /> Rate your order
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {targets.map((t) => (
            <div key={key(t)} className="rounded-lg border border-white/10 bg-[#0f1216] p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {t.kind === "vendor" ? <Store size={15} className="text-[#ff7a2f]" /> : <Package size={15} className="text-[#ff7a2f]" />}
                {titleCase(t.name)}
                <span className="text-[10px] uppercase tracking-wider text-white/40">{t.kind}</span>
              </div>
              <StarPicker value={ratings[key(t)]?.stars || 0} onChange={(s) => setStars(t, s)} />
              <input
                value={ratings[key(t)]?.comment || ""}
                onChange={(e) => setComment(t, e.target.value)}
                placeholder="Add a short comment (optional)"
                className="mt-2 w-full rounded-md border border-white/10 bg-[#171c22] px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/30"
              />
            </div>
          ))}
          <Button data-testid="rate-submit" onClick={submit} disabled={busy} className="w-full bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822]">
            {busy ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Star size={16} className="mr-1.5" />}
            Submit ratings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

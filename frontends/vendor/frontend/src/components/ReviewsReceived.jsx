import { useEffect, useState } from "react";
import { getRatings } from "@/lib/api";
import { Star, MessageSquare } from "lucide-react";

export default function ReviewsReceived({ vendorId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!vendorId) return;
    getRatings("vendor", vendorId).then(setData).catch(() => setData(null));
  }, [vendorId]);

  if (!data) return null;
  const avg = data.summary?.average ?? 0;
  const count = data.summary?.count ?? 0;
  const reviews = data.ratings || [];

  return (
    <div className="rounded-lg border border-white/10 bg-[#171c22] p-4 sm:p-5" data-testid="vendor-reviews-received">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold tracking-tight text-white">Reviews received</h2>
        <div className="flex items-center gap-1.5">
          <Star size={16} className="fill-[#ff7a2f] text-[#ff7a2f]" />
          <span className="font-heading text-lg font-bold text-white">{Number(avg).toFixed(1)}</span>
          <span className="text-xs text-[#94a3b8]">({count})</span>
        </div>
      </div>
      {reviews.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#94a3b8]">No buyer reviews yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {reviews.slice(0, 6).map((r) => (
            <div key={r.id} className="rounded-md border border-white/10 bg-[#0f1216] p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-white">{r.by?.name || "Buyer"}</span>
                <span className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={12} className={r.stars >= n ? "fill-[#ff7a2f] text-[#ff7a2f]" : "text-white/20"} />
                  ))}
                </span>
              </div>
              {r.comment ? (
                <p className="flex items-start gap-1.5 text-xs text-[#94a3b8]">
                  <MessageSquare size={11} className="mt-0.5 shrink-0" /> {r.comment}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

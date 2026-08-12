import { useEffect, useState, useCallback } from "react";
import { Star, EyeSlash, Eye, CircleNotch, ShieldWarning } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const KIND_COLOR = {
  vendor: "bg-sky-500/15 text-sky-300",
  product: "bg-emerald-500/15 text-emerald-400",
  delivery: "bg-[#f59e0b]/15 text-[#f59e0b]",
  care: "bg-fuchsia-500/15 text-fuchsia-300",
};
const FILTERS = ["all", "vendor", "product", "delivery", "care"];

export default function RatingsModeration() {
  const [overview, setOverview] = useState(null);
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => {
    api.modRatings().then(setList).catch(() => setList([]));
    api.modRatingsOverview().then(setOverview).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const moderate = async (id, patch) => {
    try { await api.moderateRating(id, patch); toast.success("Rating updated"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const rows = (list || []).filter((r) => filter === "all" || r.kind === filter);

  return (
    <>
      <div className="mb-5">
        <h1 className="font-head text-2xl font-extrabold tracking-tight text-white">Ratings Moderation</h1>
        <p className="text-xs text-white/45">Review customer ratings; hide or correct unfair ones. Averages exclude hidden ratings.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {["vendor", "product", "delivery", "care"].map((k) => (
          <div key={k} className="border border-white/10 bg-[#171c22] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 capitalize">{k}</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-xl font-bold text-white">
              {overview?.[k]?.average ?? "—"} {overview?.[k]?.average != null && <Star size={14} weight="fill" className="text-[#ff7a2f]" />}
            </p>
            <p className="text-[10px] text-white/40">{overview?.[k]?.count ?? 0} ratings</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${filter === f ? "border-[#ff7a2f] bg-[#ff7a2f]/10 text-[#ff7a2f]" : "border-white/10 text-white/50 hover:bg-white/5"}`}>
            {f}
          </button>
        ))}
      </div>

      {list === null ? (
        <p className="py-10 text-center text-white/40"><CircleNotch size={20} className="mx-auto animate-spin" /></p>
      ) : rows.length === 0 ? (
        <p className="border border-dashed border-white/10 bg-[#171c22] py-12 text-center text-sm text-white/40">No ratings in this view.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className={`flex flex-wrap items-center gap-3 border border-white/10 bg-[#171c22] p-3 ${r.hidden ? "opacity-50" : ""}`} data-testid={`mod-rating-${r.id}`}>
              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${KIND_COLOR[r.kind]}`}>{r.kind}</span>
              <span className="text-sm font-medium text-white">{r.target_name || r.target_id}</span>
              <span className="flex items-center">
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} weight={r.stars >= n ? "fill" : "regular"} className={r.stars >= n ? "text-[#ff7a2f]" : "text-white/25"} />)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-white/50">{r.by?.name} · {r.comment || "no comment"}</span>
              <select value={r.stars} onChange={(e) => moderate(r.id, { stars: Number(e.target.value) })}
                className="border border-white/10 bg-[#0f1216] px-1.5 py-1 text-xs text-white">
                {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s}★</option>)}
              </select>
              <button onClick={() => moderate(r.id, { hidden: !r.hidden })} data-testid={`mod-hide-${r.id}`}
                className={`inline-flex items-center gap-1 border px-2.5 py-1.5 text-xs transition-colors ${r.hidden ? "border-emerald-500/40 text-emerald-400" : "border-white/10 text-white/50 hover:border-red-500/40 hover:text-red-400"}`}>
                {r.hidden ? <><Eye size={13} /> Unhide</> : <><EyeSlash size={13} /> Hide</>}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-white/40"><ShieldWarning size={13} className="text-[#f59e0b]" /> Only managers and admins can moderate. Vendors cannot rate.</p>
    </>
  );
}

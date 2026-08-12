import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { Star, EyeOff, Eye, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KIND_COLOR = {
  vendor: "bg-sky-500/15 text-sky-300",
  product: "bg-emerald-500/15 text-emerald-400",
  delivery: "bg-amber-500/15 text-amber-400",
  care: "bg-fuchsia-500/15 text-fuchsia-300",
};

function Stars({ n }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={13} className={i <= n ? "fill-cm-accent text-cm-accent" : "text-cm-muted/40"} />
      ))}
    </span>
  );
}

export default function Ratings() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const overviewQ = useQuery({ queryKey: ["rating-overview"], queryFn: async () => (await api.get("/moderation/ratings/overview")).data });
  const listQ = useQuery({ queryKey: ["mod-ratings"], queryFn: async () => (await api.get("/moderation/ratings")).data });
  const o = overviewQ.data;
  const rows = (listQ.data || []).filter((r) => filter === "all" || r.kind === filter);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["mod-ratings"] });
    qc.invalidateQueries({ queryKey: ["rating-overview"] });
  };

  const moderate = useMutation({
    mutationFn: async ({ id, patch }) => (await api.put(`/moderation/ratings/${id}`, patch)).data,
    onSuccess: () => { toast.success("Rating updated"); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["vendor", "product", "delivery", "care"].map((k) => (
          <div key={k} className="rounded-lg border border-cm-border bg-cm-panel p-4">
            <p className="text-xs uppercase tracking-wide text-cm-muted capitalize">{k}</p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-2xl font-700 text-cm-text">
              {o?.[k]?.average ?? "—"}
              {o?.[k]?.average != null && <Star size={16} className="fill-cm-accent text-cm-accent" />}
            </p>
            <p className="text-xs text-cm-muted">{o?.[k]?.count ?? 0} ratings</p>
          </div>
        ))}
      </div>
      {o && (
        <p className="text-xs text-cm-muted">
          {o.total} total · {o.hidden} hidden. Customers rate; managers and admins moderate. Vendors cannot rate.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {["all", "vendor", "product", "delivery", "care"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-xs font-500 capitalize transition-colors ${
              filter === f ? "border-cm-accent bg-cm-accent/10 text-cm-accent" : "border-cm-border text-cm-muted hover:bg-cm-panel2"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-cm-border bg-cm-panel">
        {listQ.isLoading ? (
          <p className="py-12 text-center text-cm-muted"><Loader2 className="mx-auto animate-spin" size={20} /></p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-cm-muted">No ratings in this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-cm-border text-left text-xs uppercase tracking-wide text-cm-muted">
                  <th className="px-5 py-3">Kind</th>
                  <th className="px-5 py-3">Target</th>
                  <th className="px-5 py-3">By</th>
                  <th className="px-5 py-3">Stars</th>
                  <th className="px-5 py-3">Comment</th>
                  <th className="px-5 py-3 text-right">Moderate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b border-cm-border/60 last:border-0 ${r.hidden ? "opacity-50" : ""}`} data-testid={`rating-${r.id}`}>
                    <td className="px-5 py-3"><span className={`rounded px-2 py-0.5 text-xs font-500 capitalize ${KIND_COLOR[r.kind]}`}>{r.kind}</span></td>
                    <td className="px-5 py-3 text-cm-text">{r.target_name || r.target_id}</td>
                    <td className="px-5 py-3 text-cm-muted">{r.by?.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Stars n={r.stars} />
                        <select
                          value={r.stars}
                          onChange={(e) => moderate.mutate({ id: r.id, patch: { stars: Number(e.target.value) } })}
                          data-testid={`rating-stars-${r.id}`}
                          className="rounded border border-cm-border bg-cm-bg px-1.5 py-0.5 text-xs text-cm-text"
                        >
                          {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-[240px] truncate text-cm-muted">{r.comment || "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => moderate.mutate({ id: r.id, patch: { hidden: !r.hidden } })}
                        data-testid={`rating-hide-${r.id}`}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                          r.hidden ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" : "border-cm-border text-cm-muted hover:border-red-500/40 hover:text-red-400"
                        }`}
                      >
                        {r.hidden ? <><Eye size={13} /> Unhide</> : <><EyeOff size={13} /> Hide</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-cm-muted">
        <ShieldAlert size={13} className="text-amber-400" /> Hidden ratings are excluded from averages. Set a hard override on a vendor from its profile drawer.
      </p>
    </div>
  );
}

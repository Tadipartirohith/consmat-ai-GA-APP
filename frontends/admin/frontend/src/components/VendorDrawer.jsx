import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, FileText, FileCheck2, Clock, Building2, Phone, Mail, MapPin, CalendarDays, Star, ShieldAlert, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StarRating } from "@/components/StarRating";
import { api, formatINR, compactINR, apiErrorMessage } from "@/lib/api";
import { toast } from "sonner";

function RatingOverride({ vendorId, current }) {
  const qc = useQueryClient();
  const [val, setVal] = useState("");
  const set = useMutation({
    mutationFn: async (value) => (await api.put(`/admin/vendors/${vendorId}/rating-override`, { value })).data,
    onSuccess: () => {
      toast.success("Vendor rating updated");
      qc.invalidateQueries({ queryKey: ["vendor", vendorId] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setVal("");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs">
      <span className="flex items-center gap-1 font-500 text-amber-400"><ShieldAlert size={13} /> Moderation:</span>
      <span className="text-cm-muted">override the shown rating</span>
      <input
        type="number" min="0" max="5" step="0.1" value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="0-5"
        data-testid="rating-override-input"
        className="w-16 rounded border border-cm-border bg-cm-bg px-2 py-1 text-center text-cm-text outline-none"
      />
      <button onClick={() => val !== "" && set.mutate(Number(val))} data-testid="rating-override-apply" className="rounded bg-cm-accent px-2.5 py-1 font-600 text-black">Apply</button>
      <button onClick={() => set.mutate(null)} className="flex items-center gap-1 rounded border border-cm-border px-2 py-1 text-cm-muted hover:text-cm-text"><X size={11} /> Clear</button>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon size={15} className="mt-0.5 shrink-0 text-cm-muted" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-cm-muted">{label}</div>
        <div className="break-words text-sm text-cm-text">{value || "—"}</div>
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  delivered: "text-emerald-400",
  in_transit: "text-sky-400",
  processing: "text-cm-accent",
  cancelled: "text-red-400",
};

export function VendorDrawer({ vendorId, open, onOpenChange, onApprove, approving }) {
  const detailQ = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn: async () => (await api.get(`/admin/vendors/${vendorId}`)).data,
    enabled: !!vendorId && open,
  });
  const v = detailQ.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-cm-border bg-cm-panel p-0 text-cm-text sm:max-w-lg">
        <SheetTitle className="sr-only">Vendor profile</SheetTitle>
        <SheetDescription className="sr-only">Vendor details, documents and order history</SheetDescription>

        {detailQ.isLoading || !v ? (
          <div className="flex h-64 items-center justify-center text-cm-muted">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : (
          <div data-testid="vendor-drawer">
            {/* Header */}
            <div className="border-b border-cm-border bg-cm-panel2/40 px-6 py-6">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-cm-accent/15 text-cm-accent">
                  <Building2 size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-xl font-600 tracking-tight text-cm-text">{v.name}</h2>
                  <div className="mt-0.5 text-sm text-cm-muted">{v.category} · {v.city}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <StarRating value={v.rating} size={14} />
                    <span className="text-xs text-cm-muted">{v.rating_count} ratings</span>
                    {v.kyc_status === "approved" ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-500 text-emerald-400"><FileCheck2 size={12} /> KYC Approved</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-500 text-yellow-400"><Clock size={12} /> KYC Pending</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* Business info */}
              <section>
                <h3 className="mb-2 font-heading text-sm font-600 uppercase tracking-wide text-cm-muted">Business Details</h3>
                <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  <InfoRow icon={FileText} label="GSTIN" value={v.gstin} />
                  <InfoRow icon={CalendarDays} label="Established" value={v.established} />
                  <InfoRow icon={Phone} label="Phone" value={v.phone} />
                  <InfoRow icon={Mail} label="Email" value={v.email} />
                  <InfoRow icon={Building2} label="Primary Contact" value={v.contact} />
                  <InfoRow icon={MapPin} label="Address" value={v.address} />
                </div>
              </section>

              {/* Ratings & Reviews */}
              <section>
                <h3 className="mb-2 font-heading text-sm font-600 uppercase tracking-wide text-cm-muted">Ratings & Reviews</h3>
                <RatingOverride vendorId={v.id} current={v.rating} />
                {(() => {
                  const bd = v.rating_breakdown || {};
                  const total = Object.values(bd).reduce((a, b) => a + b, 0);
                  return (
                    <div className="rounded-md border border-cm-border bg-cm-bg p-4" data-testid="vendor-rating-insights">
                      <div className="flex items-center gap-5">
                        <div className="text-center">
                          <div className="font-heading text-4xl font-700 leading-none text-cm-text">{(Number(v.rating) || 0).toFixed(1)}</div>
                          <div className="mt-1.5 flex justify-center"><StarRating value={v.rating} size={12} showValue={false} /></div>
                          <div className="mt-1 text-xs text-cm-muted">{total} ratings</div>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          {["5", "4", "3", "2", "1"].map((star) => {
                            const count = bd[star] || 0;
                            const pct = total ? Math.round((count / total) * 100) : 0;
                            return (
                              <div key={star} className="flex items-center gap-2" data-testid={`rating-bar-${star}`}>
                                <span className="w-3 text-right text-xs text-cm-muted">{star}</span>
                                <Star size={11} className="text-cm-accent" fill="currentColor" strokeWidth={0} />
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cm-panel2">
                                  <div className="h-full rounded-full bg-cm-accent" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-8 text-right text-xs text-cm-muted">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {(v.reviews || []).length > 0 && (
                        <div className="mt-4 space-y-3 border-t border-cm-border pt-4" data-testid="vendor-reviews">
                          {(v.reviews || []).map((r, idx) => (
                            <div key={idx} className="text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-500 text-cm-text">{r.buyer}</span>
                                <StarRating value={r.rating} size={11} showValue={false} />
                              </div>
                              <p className="mt-0.5 text-cm-muted">{r.comment}</p>
                              <div className="mt-0.5 text-xs text-cm-muted/70">{r.date}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </section>

              {/* Documents */}
              <section>
                <h3 className="mb-2 font-heading text-sm font-600 uppercase tracking-wide text-cm-muted">KYC Documents</h3>
                <div className="space-y-2" data-testid="vendor-documents">
                  {(v.documents || []).map((d) => (
                    <div key={d.name} className="flex items-center gap-3 rounded-md border border-cm-border bg-cm-bg px-3 py-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded bg-cm-panel2 text-cm-muted"><FileText size={15} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-cm-text">{d.name}</div>
                        <div className="text-xs text-cm-muted">{d.type} · {d.size_kb} KB</div>
                      </div>
                      {d.status === "verified" ? (
                        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-500 text-emerald-400">VERIFIED</span>
                      ) : (
                        <span className="rounded border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-500 text-yellow-400">PENDING</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Order history */}
              <section>
                <h3 className="mb-2 font-heading text-sm font-600 uppercase tracking-wide text-cm-muted">
                  Order History {v.order_history?.length ? `(${v.order_history.length})` : ""}
                </h3>
                {v.order_history && v.order_history.length > 0 ? (
                  <div className="divide-y divide-cm-border rounded-md border border-cm-border" data-testid="vendor-order-history">
                    {v.order_history.map((o) => (
                      <div key={o.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs text-cm-muted">{o.id}</div>
                          <div className="truncate text-sm text-cm-text">{o.item}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm text-cm-text">{formatINR(o.amount)}</div>
                          <div className={`text-xs capitalize ${STATUS_STYLES[o.status] || "text-cm-muted"}`}>{String(o.status).replace("_", " ")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-cm-border px-4 py-6 text-center text-sm text-cm-muted">
                    No orders yet — this vendor has not transacted.
                  </div>
                )}
              </section>
            </div>

            {/* Approve action */}
            {v.kyc_status === "pending" && (
              <div className="sticky bottom-0 border-t border-cm-border bg-cm-panel px-6 py-4">
                <button
                  onClick={() => onApprove(v.id)}
                  disabled={approving}
                  data-testid="drawer-approve-kyc-button"
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-cm-accent px-4 py-2.5 text-sm font-600 text-black transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
                >
                  {approving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Approve KYC & Activate Vendor
                </button>
                <p className="mt-2 text-center text-xs text-cm-muted">Review all documents above before approving.</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

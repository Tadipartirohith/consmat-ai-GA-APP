import React from "react";
import { CheckCircle2, Circle, Package, Truck, User, Phone, Mail, MapPin, Store, XCircle, Printer } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StarRating } from "@/components/StarRating";
import { formatINR } from "@/lib/api";
import { openInvoiceWindow } from "@/lib/invoice";
import { toast } from "sonner";

const STATUS_STYLES = {
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  in_transit: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  processing: "bg-cm-accent/10 text-cm-accent border-cm-accent/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

function fmtDate(s) {
  try {
    return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}

function printInvoice(o) {
  const ok = openInvoiceWindow([o], `Invoice ${o.id}`);
  if (!ok) toast.error("Popup blocked", { description: "Allow popups to print the invoice." });
}

function ContactRow({ icon: Icon, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-1">
      <Icon size={14} className="mt-0.5 shrink-0 text-cm-muted" />
      <span className="break-words text-sm text-cm-text">{value}</span>
    </div>
  );
}

export function OrderDrawer({ order, open, onOpenChange }) {
  const o = order;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-cm-border bg-cm-panel p-0 text-cm-text sm:max-w-lg">
        <SheetTitle className="sr-only">Order details</SheetTitle>
        <SheetDescription className="sr-only">Line items, delivery timeline and buyer contact</SheetDescription>

        {o && (
          <div data-testid="order-drawer">
            {/* Header */}
            <div className="border-b border-cm-border bg-cm-panel2/40 px-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-cm-muted">{o.id}</div>
                  <h2 className="mt-0.5 font-heading text-2xl font-700 tracking-tight text-cm-text">{formatINR(o.amount)}</h2>
                </div>
                <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-500 capitalize ${STATUS_STYLES[o.status] || "border-cm-border text-cm-muted"}`}>
                  {String(o.status).replace("_", " ")}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-cm-muted">
                <Store size={14} /> {o.vendor}
                {o.rating > 0 && <span className="ml-auto"><StarRating value={o.rating} size={13} /></span>}
              </div>
              <div className="mt-1 text-xs text-cm-muted">Placed {fmtDate(o.created_at)}</div>
              <button
                onClick={() => printInvoice(o)}
                data-testid="print-invoice-button"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-cm-accent px-4 py-2 text-sm font-600 text-black transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <Printer size={15} /> Print Invoice
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* Line items */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-600 uppercase tracking-wide text-cm-muted"><Package size={15} /> Line Items</h3>
                <div className="overflow-hidden rounded-md border border-cm-border" data-testid="order-line-items">
                  {(o.line_items || []).map((li, i) => (
                    <div key={i} className="flex items-center gap-3 border-b border-cm-border/60 px-3 py-2.5 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-cm-text">{li.name}</div>
                        <div className="text-xs text-cm-muted">{li.qty} {li.unit} × {formatINR(li.unit_price)}</div>
                      </div>
                      <div className="font-mono text-sm text-cm-text">{formatINR(li.amount)}</div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-cm-panel2/50 px-3 py-2.5">
                    <span className="text-sm font-500 text-cm-text">Order Total</span>
                    <span className="font-mono text-sm font-700 text-cm-accent">{formatINR(o.amount)}</span>
                  </div>
                </div>
              </section>

              {/* Delivery timeline */}
              <section>
                <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-600 uppercase tracking-wide text-cm-muted"><Truck size={15} /> Delivery Timeline</h3>
                <ol className="relative space-y-4 pl-1" data-testid="order-timeline">
                  {(o.timeline || []).map((t, i, arr) => {
                    const cancelled = t.key === "cancelled";
                    return (
                      <li key={t.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          {cancelled ? (
                            <XCircle size={18} className="text-red-400" />
                          ) : t.done ? (
                            <CheckCircle2 size={18} className="text-cm-accent" />
                          ) : (
                            <Circle size={18} className="text-cm-border" />
                          )}
                          {i < arr.length - 1 && <span className={`mt-1 w-px flex-1 ${t.done ? "bg-cm-accent/40" : "bg-cm-border"}`} style={{ minHeight: 18 }} />}
                        </div>
                        <div className="pb-1">
                          <div className={`text-sm ${t.done ? "text-cm-text" : "text-cm-muted"}`}>{t.label}</div>
                          {t.done && <div className="text-xs text-cm-muted">{fmtDate(t.at)}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {/* Buyer contact */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-600 uppercase tracking-wide text-cm-muted"><User size={15} /> Buyer</h3>
                <div className="rounded-md border border-cm-border bg-cm-bg px-4 py-3" data-testid="order-buyer">
                  <div className="text-sm font-500 text-cm-text">{o.buyer}</div>
                  {o.buyer_contact?.contact && <div className="text-xs text-cm-muted">Attn: {o.buyer_contact.contact}</div>}
                  <div className="mt-2">
                    <ContactRow icon={Phone} value={o.buyer_contact?.phone} />
                    <ContactRow icon={Mail} value={o.buyer_contact?.email} />
                    <ContactRow icon={MapPin} value={o.buyer_contact?.address} />
                    <ContactRow icon={User} value={o.buyer_contact?.gstin ? `GSTIN: ${o.buyer_contact.gstin}` : null} />
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { optimize } from "@/lib/api";
import { formatINR, formatNumber, titleCase, cartLineTotal, cartGrandTotal } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Zap, Split, Layers, TrendingDown, ShoppingCart, PackageSearch } from "lucide-react";
import { CheckoutModal } from "@/components/CheckoutModal";
import { toast } from "sonner";

export function CartSheet({ open, onOpenChange }) {
  const { cart, updateCartItem, removeCartItem, location } = useApp();
  const [opt, setOpt] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const runOptimize = async () => {
    if (!cart.length) return;
    setOptimizing(true);
    setOpt(null);
    try {
      const data = await optimize({
        items: cart.map((c) => ({
          material: c.material,
          quantity: c.quantity,
          unit: c.unit,
          vendor: c.vendor,
        })),
        location,
      });
      setOpt(data);
    } catch (e) {
      toast.error("Optimize failed. Backend not reachable.");
    } finally {
      setOptimizing(false);
    }
  };

  const g = (o, keys, fb) => {
    for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null) return o[k];
    return fb;
  };

  const savings = opt ? g(opt, ["savings", "total_savings", "saved"]) : null;
  const splitPlan = opt ? g(opt, ["split", "split_sourcing", "split_plan"], []) : [];
  const singlePlan = opt ? g(opt, ["single", "single_sourcing", "single_plan"]) : null;
  const recommended = opt ? g(opt, ["recommended", "recommendation"], "split") : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          data-testid="cart-sheet"
          className="flex w-full flex-col border-white/10 bg-[#0f1216] text-white sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle className="font-head flex items-center gap-2 text-xl text-white">
              <ShoppingCart size={20} className="text-[#ff7a2f]" /> Your Cart
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto py-4">
            {cart.length === 0 ? (
              <div
                data-testid="cart-empty-nudge"
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#171c22] text-[#ff7a2f]">
                  <PackageSearch size={30} />
                </div>
                <p className="font-head text-lg font-bold">Your cart is empty</p>
                <p className="mt-1 max-w-[240px] text-sm text-white/50">
                  Browse materials and add vendor matches to build your order.
                </p>
                <Button
                  data-testid="cart-browse-materials-btn"
                  onClick={() => onOpenChange(false)}
                  className="mt-5 bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822]"
                >
                  <ShoppingCart size={16} className="mr-1.5" /> Browse materials
                </Button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  data-testid="cart-item"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#171c22] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {titleCase(item.material)}
                      {item.brand ? <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">{item.brand}</span> : null}
                    </p>
                    <p className="truncate text-xs text-white/50">
                      {item.vendor ? item.vendor : "best vendor"}
                    </p>
                    <p className="mt-0.5 font-mono text-sm text-[#ff7a2f]">{formatINR(cartLineTotal(item))}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Input
                      data-testid="cart-item-qty"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateCartItem(item.id, { quantity: Math.max(0, Number(e.target.value)) })
                      }
                      className="h-9 w-24 border-white/10 bg-[#0f1216] text-center"
                    />
                    <span className="text-[10px] text-white/40">{item.unit}</span>
                  </div>
                  <button
                    data-testid="cart-item-remove"
                    onClick={() => removeCartItem(item.id)}
                    className="text-white/40 hover:text-red-400"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}

            {opt && (
              <div className="mt-4 space-y-3 animate-fade-up" data-testid="optimize-result">
                {savings !== undefined && savings !== null && Number(savings) > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 p-4">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#22c55e]">
                      <TrendingDown size={18} /> Potential savings
                    </span>
                    <span className="font-mono text-xl font-bold text-[#22c55e]">
                      {formatINR(savings)}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  <PlanCard
                    title="Split sourcing"
                    icon={Split}
                    active={recommended === "split"}
                    total={g(opt, ["split_total", "split_cost"]) ?? sumPlan(splitPlan)}
                    lines={normalizePlan(splitPlan)}
                    note="Cheapest reliable vendor per material, covering your whole cart."
                  />
                  {(() => {
                    const covered = Number(g(singlePlan || {}, ["covered"], 0));
                    const incomplete = covered > 0 && covered < cart.length;
                    return (
                      <PlanCard
                        title="Single sourcing"
                        icon={Layers}
                        active={recommended === "single"}
                        total={g(singlePlan || {}, ["total", "cost", "single_total"])}
                        lines={normalizePlan(g(singlePlan || {}, ["items", "lines"], singlePlan))}
                        note={
                          incomplete
                            ? `One vendor can only supply ${covered} of ${cart.length} items, so its total is not comparable.`
                            : "One vendor for the whole order."
                        }
                        warn={incomplete}
                      />
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-sm text-white/60">
                  Estimated total <span className="text-white/35">(delivered)</span>
                </span>
                <span data-testid="cart-total" className="font-mono text-lg font-bold text-[#ff7a2f]">
                  {formatINR(cartGrandTotal(cart))}
                </span>
              </div>
              <Button
                data-testid="optimize-btn"
                onClick={runOptimize}
                disabled={optimizing}
                variant="outline"
                className="w-full border-[#ff7a2f]/40 bg-transparent text-[#ff7a2f] hover:bg-[#ff7a2f]/10 hover:text-[#ff7a2f]"
              >
                <Zap size={16} className="mr-1.5" />
                {optimizing ? "Optimizing..." : "Optimize sourcing"}
              </Button>
              <Button
                data-testid="cart-checkout-btn"
                onClick={() => setCheckoutOpen(true)}
                className="w-full bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822]"
              >
                Checkout
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        optimizeResult={opt}
        onDone={() => {
          setCheckoutOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

function normalizePlan(plan) {
  if (!plan) return [];
  if (Array.isArray(plan)) return plan;
  return [];
}
function sumPlan(plan) {
  if (!Array.isArray(plan)) return undefined;
  const t = plan.reduce((a, p) => a + Number(p.landed_price ?? p.price ?? p.total ?? 0), 0);
  return t || undefined;
}

function PlanCard({ title, icon: Icon, active, total, lines, note, warn }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active ? "border-[#ff7a2f] bg-[#ff7a2f]/5" : "border-white/10 bg-[#171c22]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon size={16} className={active ? "text-[#ff7a2f]" : "text-white/50"} />
          {title}
          {active && (
            <span className="rounded-full bg-[#ff7a2f] px-2 py-0.5 text-[10px] font-bold text-black">
              BEST
            </span>
          )}
        </span>
        {total !== undefined && total !== null && (
          <span className="font-mono font-bold">{formatINR(total)}</span>
        )}
      </div>
      {note && (
        <p className={`mb-2 text-[11px] ${warn ? "text-[#f59e0b]" : "text-white/40"}`}>{note}</p>
      )}
      {lines && lines.length > 0 && (
        <div className="space-y-1">
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between text-xs text-white/60">
              <span>
                {titleCase(l.material || l.name || "")}
                {l.vendor ? ` · ${l.vendor}` : ""}
              </span>
              <span className="font-mono">{formatINR(l.landed_price ?? l.price ?? l.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

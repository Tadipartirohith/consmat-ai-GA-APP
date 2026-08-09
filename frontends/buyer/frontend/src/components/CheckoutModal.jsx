import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { checkout } from "@/lib/api";
import { formatINR, titleCase } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, CreditCard, Landmark, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const METHODS = [
  { id: "upi", label: "UPI", icon: Smartphone, desc: "Pay via any UPI app" },
  { id: "card", label: "Card", icon: CreditCard, desc: "Credit / Debit card" },
  { id: "credit", label: "Credit", icon: Landmark, desc: "Buy now, pay later" },
];

export function CheckoutModal({ open, onOpenChange, optimizeResult, onDone }) {
  const { cart, clearCart, location } = useApp();
  const [method, setMethod] = useState("upi");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null);

  const total = cart.reduce(
    (a, c) => a + Number(c.price || 0) * Number(c.quantity || 0),
    0
  );

  const place = async () => {
    setPlacing(true);
    try {
      const data = await checkout({
        items: cart.map((c) => ({
          material: c.material,
          quantity: c.quantity,
          unit: c.unit,
          vendor: c.vendor,
          price: c.price,
        })),
        payment_method: method,
        location,
        optimize: optimizeResult || undefined,
      });
      setPlaced(data || { order_id: "confirmed" });
      clearCart();
      toast.success("Order placed successfully!");
    } catch (e) {
      toast.error("Checkout failed. Backend not reachable.");
    } finally {
      setPlacing(false);
    }
  };

  const close = () => {
    setPlaced(null);
    onOpenChange(false);
    if (placed) onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        data-testid="checkout-modal"
        className="border-white/10 bg-[#171c22] text-white sm:max-w-md"
      >
        {placed ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 size={56} className="mb-4 text-[#22c55e]" />
            <h3 className="font-head text-2xl font-bold">Order placed</h3>
            <p className="mt-1 text-sm text-white/60">
              Order ID:{" "}
              <span className="font-mono text-[#ff7a2f]">
                {placed.order_id || placed.id || placed.orderId || "—"}
              </span>
            </p>
            <Button
              data-testid="checkout-done-btn"
              onClick={close}
              className="mt-6 w-full bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822]"
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-head text-xl">Checkout</DialogTitle>
            </DialogHeader>

            <div className="space-y-2 rounded-lg bg-black/25 p-3 text-sm">
              {cart.map((c) => (
                <div key={c.id} className="flex justify-between text-white/70">
                  <span>
                    {titleCase(c.material)} × {c.quantity}
                  </span>
                  <span className="font-mono">{formatINR(Number(c.price || 0) * c.quantity)}</span>
                </div>
              ))}
              {total > 0 && (
                <div className="mt-1 flex justify-between border-t border-white/10 pt-2 font-semibold">
                  <span>Total</span>
                  <span className="font-mono text-[#ff7a2f]">{formatINR(total)}</span>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                Payment method
              </p>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = method === m.id;
                  return (
                    <button
                      key={m.id}
                      data-testid={`payment-method-${m.id}`}
                      onClick={() => setMethod(m.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${
                        active
                          ? "border-[#ff7a2f] bg-[#ff7a2f]/10 text-[#ff7a2f]"
                          : "border-white/10 bg-[#0f1216] text-white/60 hover:border-white/30"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-semibold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-white/40">
                {METHODS.find((m) => m.id === method)?.desc}
              </p>
            </div>

            <Button
              data-testid="place-order-btn"
              onClick={place}
              disabled={placing || cart.length === 0}
              className="w-full bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822]"
            >
              {placing ? (
                <>
                  <Loader2 size={16} className="mr-1.5 animate-spin" /> Placing...
                </>
              ) : (
                `Place order${total > 0 ? " · " + formatINR(total) : ""}`
              )}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

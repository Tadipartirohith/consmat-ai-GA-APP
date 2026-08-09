import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Header } from "@/components/Header";
import { ShopMode } from "@/components/ShopMode";
import { ChatMode } from "@/components/ChatMode";
import { EstimateMode } from "@/components/EstimateMode";
import { CartSheet } from "@/components/CartSheet";
import { OrdersSheet } from "@/components/OrdersSheet";
import { Store, MessagesSquare, Calculator } from "lucide-react";

const MODES = [
  { id: "shop", label: "Shop", icon: Store },
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "estimate", label: "Estimate", icon: Calculator },
];

export default function Home() {
  const { cart, cartOpen, setCartOpen, ordersOpen, setOrdersOpen } = useApp();
  const [mode, setMode] = useState("shop");

  return (
    <div className="min-h-screen bg-[#0f1216]">
      <Header
        onOpenCart={() => setCartOpen(true)}
        onOpenOrders={() => setOrdersOpen(true)}
        cartCount={cart.length}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        {/* Mode toggle */}
        <div className="mb-6 inline-flex rounded-xl border border-white/10 bg-[#171c22] p-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                data-testid={`mode-tab-${m.id}`}
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-[#ff7a2f] text-black" : "text-white/60 hover:text-white"
                }`}
              >
                <Icon size={16} /> {m.label}
              </button>
            );
          })}
        </div>

        {mode === "shop" && <ShopMode />}
        {mode === "chat" && <ChatMode />}
        {mode === "estimate" && <EstimateMode />}
      </main>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
      <OrdersSheet open={ordersOpen} onOpenChange={setOrdersOpen} />
    </div>
  );
}

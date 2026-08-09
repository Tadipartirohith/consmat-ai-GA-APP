import React, { useState, useRef, useEffect } from "react";
import { aiChat } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { VendorCard } from "@/components/VendorCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Bot, User, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export function ChatMode() {
  const { location, priceQuality, addManyToCart } = useApp();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      reply:
        "Hi! I'm your procurement assistant. Tell me what you're building or what materials you need, and I'll find the best vendors.",
      chips: ["Steel for 2000 sq ft slab", "Cheapest cement near me", "TMT bars 500 units"],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", reply: msg }]);
    setLoading(true);
    try {
      const data = await aiChat({ message: msg, location, price_quality: priceQuality });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          reply: data?.reply || data?.message || "Here's what I found.",
          chips: data?.chips || data?.suggestions_chips || [],
          cards: data?.cards || data?.vendors || data?.ranked || [],
          suggestions: data?.suggestions || data?.cart_suggestions || [],
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", reply: "I couldn't reach the assistant right now. Please try again.", error: true },
      ]);
      toast.error("Chat request failed.");
    } finally {
      setLoading(false);
    }
  };

  const addAll = (suggestions, cards) => {
    const items = (suggestions?.length ? suggestions : cards) || [];
    if (!items.length) {
      toast.error("No items to add.");
      return;
    }
    addManyToCart(
      items.map((it) => ({
        material: it.material || it.name || it.vendor,
        quantity: it.quantity || 1,
        unit: it.unit || "units",
        vendor: it.vendor || it.vendor_name,
        price: it.landed_price ?? it.price,
      }))
    );
  };

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[480px] flex-col rounded-xl border border-white/10 bg-[#171c22]">
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6" data-testid="chat-messages">
        {messages.map((m, i) => (
          <ChatBubble key={i} m={m} onChip={send} onAddAll={addAll} />
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Bot size={16} className="text-[#ff7a2f]" />
            <span className="flex gap-1">
              <Dot /> <Dot delay={150} /> <Dot delay={300} />
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2"
        >
          <Input
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about materials, budgets, projects..."
            className="border-white/10 bg-[#0f1216]"
          />
          <Button
            data-testid="chat-send-btn"
            type="submit"
            disabled={loading}
            className="shrink-0 bg-[#ff7a2f] text-black hover:bg-[#e66822]"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}

function ChatBubble({ m, onChip, onAddAll }) {
  const isUser = m.role === "user";
  const hasCards = m.cards && m.cards.length > 0;
  const canAddAll = (m.suggestions && m.suggestions.length > 0) || hasCards;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} animate-fade-up`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser ? "bg-white/10" : "bg-[#ff7a2f]"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} className="text-black" />}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "items-end text-right" : ""}`}>
        <div
          className={`inline-block rounded-xl px-4 py-2.5 text-sm ${
            isUser ? "bg-white/10" : m.error ? "bg-red-500/10 text-red-300" : "bg-[#0f1216]"
          }`}
        >
          {m.reply}
        </div>

        {m.chips && m.chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {m.chips.map((c, i) => (
              <button
                key={i}
                data-testid={`chat-chip-${i}`}
                onClick={() => onChip(typeof c === "string" ? c : c.label || c.text)}
                className="rounded-full border border-[#ff7a2f]/30 bg-[#ff7a2f]/10 px-3 py-1 text-xs text-[#ff7a2f] transition-colors hover:bg-[#ff7a2f]/20"
              >
                {typeof c === "string" ? c : c.label || c.text}
              </button>
            ))}
          </div>
        )}

        {hasCards && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-left">
            {m.cards.map((c, i) => (
              <VendorCard key={i} data={c} index={i} />
            ))}
          </div>
        )}

        {canAddAll && (
          <Button
            data-testid="chat-add-all-btn"
            onClick={() => onAddAll(m.suggestions, m.cards)}
            className="mt-3 bg-[#ff7a2f] text-black hover:bg-[#e66822]"
            size="sm"
          >
            <ShoppingCart size={15} className="mr-1.5" /> Add all to cart
          </Button>
        )}
      </div>
    </div>
  );
}

function Dot({ delay = 0 }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff7a2f]"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

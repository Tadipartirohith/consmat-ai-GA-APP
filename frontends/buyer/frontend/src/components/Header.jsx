import React, { useState } from "react";
import { useApp, LOCATIONS } from "@/context/AppContext";
import { toast } from "sonner";
import { titleCase } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MapPin,
  ShoppingCart,
  Receipt,
  LifeBuoy,
  LogOut,
  Volume2,
  VolumeX,
  Bell,
  Truck,
  PackageCheck,
  Trash2,
  X,
} from "lucide-react";

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Header({ onOpenCart, onOpenOrders, onOpenSupport, cartCount = 0 }) {
  const {
    location,
    setLocation,
    logout,
    ordersMoved,
    alerts,
    unseenAlerts,
    markAlertsSeen,
    clearAlerts,
    dismissAlert,
    restoreAlert,
    setFocusOrderId,
    setOrdersOpen,
    soundEnabled,
    toggleSound,
    requestPush,
  } = useApp();
  const [alertMenuOpen, setAlertMenuOpen] = useState(false);

  const jumpToOrder = (id) => {
    setAlertMenuOpen(false);
    markAlertsSeen();
    setFocusOrderId(id);
    setOrdersOpen(true);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f1216]">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff7a2f]">
              <span className="font-head text-lg font-black text-black">C</span>
            </div>
            <div className="leading-tight">
              <p className="font-head text-base font-black tracking-tight">Consmat AI</p>
              <p className="hidden text-[10px] uppercase tracking-[0.2em] text-white/40 sm:block">
                Buyer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger
                data-testid="location-picker"
                className="h-9 w-[130px] border-white/10 bg-[#171c22] text-sm sm:w-[160px]"
              >
                <MapPin size={15} className="mr-1 text-[#ff7a2f]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#171c22] text-white">
                {LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc} data-testid={`location-option-${loc}`}>
                    {titleCase(loc)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              data-testid="sound-toggle-btn"
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              title={soundEnabled ? "Mute alerts" : "Unmute alerts"}
              className="h-9 w-9 text-white/70 hover:bg-white/5 hover:text-white"
            >
              {soundEnabled ? (
                <Volume2 size={18} />
              ) : (
                <VolumeX size={18} className="text-white/40" />
              )}
            </Button>

            <DropdownMenu
              open={alertMenuOpen}
              onOpenChange={(o) => {
                setAlertMenuOpen(o);
                if (o) {
                  markAlertsSeen();
                  requestPush();
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  data-testid="alert-center-btn"
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 text-white/70 hover:bg-white/5 hover:text-white"
                >
                  <Bell size={18} />
                  {unseenAlerts > 0 && (
                    <span
                      data-testid="alert-unseen-badge"
                      className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff7a2f] px-1 text-[10px] font-bold text-black"
                    >
                      {unseenAlerts}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                data-testid="alert-center-menu"
                align="end"
                className="w-80 border-white/10 bg-[#171c22] p-0 text-white"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="font-head text-sm font-bold">Recent updates</p>
                  {alerts.length > 0 && (
                    <button
                      data-testid="clear-alerts-btn"
                      onClick={clearAlerts}
                      className="flex items-center gap-1 text-xs text-white/50 transition-colors hover:text-[#ff7a2f]"
                    >
                      <Trash2 size={13} /> Clear
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-white/40">
                      No status updates yet.
                    </p>
                  ) : (
                    alerts.map((a, i) => (
                      <div
                        key={a.id || `${a.orderId}-${a.at}-${i}`}
                        data-testid={`alert-item-${i}`}
                        className="group flex items-start border-b border-white/5 last:border-0"
                      >
                        <button
                          data-testid={`alert-open-${i}`}
                          onClick={() => jumpToOrder(a.orderId)}
                          className="flex flex-1 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                        >
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              a.bucket === "delivered"
                                ? "bg-[#22c55e]/15 text-[#22c55e]"
                                : "bg-[#ff7a2f]/15 text-[#ff7a2f]"
                            }`}
                          >
                            {a.bucket === "delivered" ? (
                              <PackageCheck size={15} />
                            ) : (
                              <Truck size={15} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm leading-snug">{a.message}</p>
                            <p className="text-[10px] uppercase tracking-wider text-white/40">
                              {timeAgo(a.at)} · Tap to view
                            </p>
                          </div>
                        </button>
                        <button
                          data-testid={`alert-dismiss-${i}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissAlert(a.id);
                            toast("Alert dismissed", {
                              action: { label: "Undo", onClick: () => restoreAlert(a) },
                            });
                          }}
                          title="Dismiss"
                          className="mr-2 mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              data-testid="open-orders-btn"
              variant="ghost"
              size="icon"
              onClick={onOpenOrders}
              className="relative h-9 w-9 text-white/70 hover:bg-white/5 hover:text-white"
            >
              <Receipt size={18} />
              {ordersMoved && (
                <span
                  data-testid="orders-moved-dot"
                  className="absolute right-1.5 top-1.5 flex h-2 w-2"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff7a2f] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff7a2f]" />
                </span>
              )}
            </Button>

            <Button
              data-testid="open-cart-btn"
              variant="ghost"
              size="icon"
              onClick={onOpenCart}
              className="relative h-9 w-9 text-white/70 hover:bg-white/5 hover:text-white"
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span
                  data-testid="cart-count-badge"
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff7a2f] px-1 text-[10px] font-bold text-black"
                >
                  {cartCount}
                </span>
              )}
            </Button>

            <Button
              data-testid="open-support-btn"
              variant="ghost"
              size="icon"
              onClick={onOpenSupport}
              title="Customer support"
              className="h-9 w-9 text-white/70 hover:bg-white/5 hover:text-white"
            >
              <LifeBuoy size={18} />
            </Button>

            <Button
              data-testid="logout-btn"
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-9 w-9 text-white/70 hover:bg-white/5 hover:text-white"
            >
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

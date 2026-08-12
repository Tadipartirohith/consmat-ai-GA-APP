import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Truck,
  Stack,
  SignOut,
  ArrowsClockwise,
  CircleNotch,
  Warning,
  ClipboardText,
  MagnifyingGlass,
  ArrowsDownUp,
  Broadcast,
  X,
  CaretDown,
  PushPin,
  Trash,
  Plus,
  UsersThree,
  Lifebuoy,
  Star,
} from "@phosphor-icons/react";
import { api, stockLevel } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import TicketCard from "@/components/TicketCard";
import StockCard from "@/components/StockCard";
import FleetTracking from "@/components/FleetTracking";
import SupportDesk from "@/components/SupportDesk";
import RatingsModeration from "@/components/RatingsModeration";

const BASE_TABS = [
  { key: "queue", label: "Dispatch Queue", icon: ClipboardText },
  { key: "fleet", label: "Live Fleet", icon: Broadcast },
  { key: "support", label: "Customer Support", icon: Lifebuoy },
  { key: "stock", label: "Network Stock", icon: Stack },
];

const QUEUE_FILTERS = ["all", "pending", "dispatched", "delivered"];

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "total", label: "₹ High" },
  { key: "priority", label: "Priority" },
];

const POLL_MS = 15000;

const INTERVALS = [
  { ms: 10000, label: "10s" },
  { ms: 30000, label: "30s" },
  { ms: 60000, label: "1m" },
];

const VIEWS_KEY = "consmat_saved_views";
const loadViews = () => {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) || "[]");
  } catch {
    return [];
  }
};

function EmptyState({ text }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center border border-dashed border-white/10 bg-[#171c22] py-16 text-center">
      <Stack size={28} className="text-white/20" />
      <p className="mt-3 text-sm text-white/40">{text}</p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center border border-red-500/30 bg-red-500/5 py-16 text-center">
      <Warning size={28} weight="fill" className="text-red-400" />
      <p className="mt-3 text-sm text-white/60">Could not reach the API.</p>
      <button
        onClick={onRetry}
        data-testid="error-retry-btn"
        className="mt-4 border border-white/15 px-4 py-2 text-xs text-white/80 transition-colors hover:bg-white/5"
      >
        Retry
      </button>
    </div>
  );
}

function Skeletons({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-64 animate-pulse border border-white/10 bg-[#171c22]" />
      ))}
    </>
  );
}

export default function Operator() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("queue");
  // Ratings moderation is manager-only (and admin).
  const TABS =
    user?.role === "manager" || user?.role === "admin"
      ? [...BASE_TABS, { key: "ratings", label: "Ratings", icon: Star }]
      : BASE_TABS;

  const [tickets, setTickets] = useState(null);
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [intervalMs, setIntervalMs] = useState(30000);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [savedViews, setSavedViews] = useState(loadViews);
  const [sharedViews, setSharedViews] = useState([]);
  const [naming, setNaming] = useState(false);
  const [viewName, setViewName] = useState("");
  const [shareChecked, setShareChecked] = useState(false);
  const alertedRef = useRef(new Set());

  const refreshShared = useCallback(async () => {
    try {
      const r = await api.listViews();
      setSharedViews(r.views || []);
    } catch {
      /* non-blocking */
    }
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(false);
      try {
        const [q, s] = await Promise.all([api.dispatchQueue(), api.networkStock()]);
        setTickets(q.tickets || []);
        setStock(s.products || []);
        refreshShared();
      } catch (e) {
        if (!silent) setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshShared]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Live polling — silently refreshes without wiping the view
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(true), intervalMs);
    return () => clearInterval(id);
  }, [autoRefresh, intervalMs, load]);

  // Apply the first pinned view on initial load so the queue opens how they like it
  useEffect(() => {
    const first = loadViews()[0];
    if (first) {
      setFilter(first.filter);
      setSearch(first.search);
      setSort(first.sort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveView = async () => {
    const name = viewName.trim() || `View ${savedViews.length + 1}`;
    const payload = { name, filter, search, sort };
    if (shareChecked) {
      try {
        await api.createView({ ...payload, created_by: user?.name });
        await refreshShared();
        toast.success(`Shared view "${name}" pinned for the team`);
      } catch (e) {
        toast.error("Could not share view");
      }
    } else {
      const next = [{ id: Date.now().toString(), ...payload }, ...savedViews].slice(0, 8);
      setSavedViews(next);
      localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
      toast.success(`View "${name}" pinned`);
    }
    setNaming(false);
    setViewName("");
    setShareChecked(false);
  };

  const applyView = (v) => {
    setFilter(v.filter);
    setSearch(v.search);
    setSort(v.sort);
  };

  const deleteView = (id) => {
    const next = savedViews.filter((v) => v.id !== id);
    setSavedViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
  };

  const deleteShared = async (id) => {
    try {
      await api.deleteView(id);
      await refreshShared();
    } catch {
      toast.error("Could not remove shared view");
    }
  };

  const handleOverdue = useCallback(
    (orderId) => {
      if (alertedRef.current.has(orderId)) return;
      alertedRef.current.add(orderId);
      setTickets((prev) =>
        (prev || []).map((t) => (t.order_id === orderId ? { ...t, overdue: true } : t))
      );
      toast.warning(`${orderId} · delivery overdue`, {
        description: "This dispatched order has passed its ETA.",
      });
    },
    []
  );

  const onTicketUpdated = (updated) => {
    setTickets((prev) =>
      (prev || []).map((t) => (t.order_id === updated.order_id ? { ...t, ...updated } : t))
    );
  };

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  };

  const counts = useMemo(() => {
    const c = { all: tickets?.length || 0, pending: 0, dispatched: 0, delivered: 0 };
    (tickets || []).forEach((t) => (c[t.status] = (c[t.status] || 0) + 1));
    return c;
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = (tickets || []).filter((t) => filter === "all" || t.status === filter);
    if (q) {
      out = out.filter(
        (t) =>
          t.order_id.toLowerCase().includes(q) ||
          (t.customer?.name || "").toLowerCase().includes(q)
      );
    }
    const prio = { high: 0, normal: 1 };
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.placed_at) - new Date(b.placed_at);
        case "total":
          return (b.total || 0) - (a.total || 0);
        case "priority":
          return (prio[a.priority] ?? 9) - (prio[b.priority] ?? 9);
        default:
          return new Date(b.placed_at) - new Date(a.placed_at);
      }
    });
    return out;
  }, [tickets, filter, search, sort]);

  const stockAlerts = useMemo(() => {
    const list = stock || [];
    return {
      out: list.filter((p) => stockLevel(p) === "out").length,
      low: list.filter((p) => stockLevel(p) === "low").length,
    };
  }, [stock]);

  return (
    <div className="min-h-screen bg-[#0f1216]">
      {/* NAV */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f1216]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center bg-[#ff7a2f]">
              <Truck size={16} weight="fill" className="text-[#0f1216]" />
            </div>
            <span className="font-head text-base font-extrabold tracking-tight text-white">
              CONSMAT<span className="text-[#ff7a2f]">.</span>OPS
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex">
              <button
                onClick={() => setAutoRefresh((v) => !v)}
                data-testid="autorefresh-toggle"
                title={autoRefresh ? "Live updates on" : "Live updates off"}
                className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-wider transition-colors ${
                  autoRefresh
                    ? "border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]"
                    : "border-white/10 text-white/40 hover:bg-white/5"
                }`}
              >
                <Broadcast size={13} weight={autoRefresh ? "fill" : "regular"} className={autoRefresh ? "animate-pulse-dot" : ""} />
                LIVE
              </button>
              <button
                onClick={() => setIntervalOpen((o) => !o)}
                disabled={!autoRefresh}
                data-testid="interval-picker-btn"
                title="Polling interval"
                className={`flex items-center gap-1 border border-l-0 px-2 py-1.5 font-mono text-[10px] font-semibold tracking-wider transition-colors disabled:opacity-40 ${
                  autoRefresh
                    ? "border-[#10b981]/40 text-[#10b981] hover:bg-white/5"
                    : "border-white/10 text-white/40"
                }`}
              >
                {INTERVALS.find((i) => i.ms === intervalMs)?.label}
                <CaretDown size={11} className={intervalOpen ? "rotate-180" : ""} />
              </button>
              {intervalOpen && autoRefresh && (
                <div
                  data-testid="interval-menu"
                  className="absolute right-0 top-full z-40 mt-1 w-24 border border-white/10 bg-[#171c22]"
                >
                  {INTERVALS.map((i) => (
                    <button
                      key={i.ms}
                      onClick={() => {
                        setIntervalMs(i.ms);
                        setIntervalOpen(false);
                      }}
                      data-testid={`interval-${i.label}`}
                      className={`flex w-full items-center justify-between px-3 py-2 font-mono text-[11px] transition-colors hover:bg-white/5 ${
                        intervalMs === i.ms ? "text-[#ff7a2f]" : "text-white/60"
                      }`}
                    >
                      every {i.label}
                      {intervalMs === i.ms && <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a2f]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => load(false)}
              data-testid="refresh-btn"
              title="Refresh"
              className="flex h-8 w-8 items-center justify-center border border-white/10 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ArrowsClockwise size={15} className={loading || refreshing ? "animate-spin" : ""} />
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-white/85">{user?.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#ff7a2f]">
                {user?.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="flex items-center gap-1.5 border border-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
            >
              <SignOut size={14} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="mx-auto flex max-w-6xl gap-6 px-4 sm:px-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                data-testid={`tab-${t.key}`}
                className={`relative flex items-center gap-2 py-3 text-sm font-medium transition-colors ${
                  active ? "text-white" : "text-white/45 hover:text-white/80"
                }`}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} />
                {t.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#ff7a2f]" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {tab === "queue" && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-head text-2xl font-extrabold tracking-tight text-white">
                  Dispatch Queue
                </h1>
                <p className="text-xs text-white/45">
                  Consolidated multi-vendor tickets awaiting action
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="queue-filters">
                {QUEUE_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    data-testid={`filter-${f}`}
                    className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                      filter === f
                        ? "border-[#ff7a2f] bg-[#ff7a2f]/10 text-[#ff7a2f]"
                        : "border-white/10 text-white/50 hover:bg-white/5"
                    }`}
                  >
                    {f} <span className="opacity-60">{counts[f] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="saved-views">
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-white/40">
                <PushPin size={12} weight="fill" /> Views
              </span>
              {sharedViews.map((v) => (
                <span
                  key={v.id}
                  data-testid={`shared-view-${v.id}`}
                  title={`Shared by ${v.created_by}`}
                  className="flex items-center gap-1.5 border border-[#3b82f6]/40 bg-[#3b82f6]/10 pl-2.5 text-xs text-white/80 transition-colors hover:border-[#3b82f6]"
                >
                  <UsersThree size={12} weight="fill" className="text-[#3b82f6]" />
                  <button
                    onClick={() => applyView(v)}
                    data-testid={`apply-shared-view-${v.id}`}
                    className="py-1.5 hover:text-[#3b82f6]"
                  >
                    {v.name}
                  </button>
                  <button
                    onClick={() => deleteShared(v.id)}
                    data-testid={`delete-shared-view-${v.id}`}
                    className="px-1.5 py-1.5 text-white/30 hover:text-red-400"
                    title="Remove shared view"
                  >
                    <Trash size={12} />
                  </button>
                </span>
              ))}
              {savedViews.map((v) => (
                <span
                  key={v.id}
                  data-testid={`saved-view-${v.id}`}
                  className="flex items-center gap-1.5 border border-white/10 bg-[#171c22] pl-2.5 text-xs text-white/70 transition-colors hover:border-[#ff7a2f]/50"
                >
                  <button
                    onClick={() => applyView(v)}
                    data-testid={`apply-view-${v.id}`}
                    className="py-1.5 hover:text-[#ff7a2f]"
                  >
                    {v.name}
                  </button>
                  <button
                    onClick={() => deleteView(v.id)}
                    data-testid={`delete-view-${v.id}`}
                    className="px-1.5 py-1.5 text-white/30 hover:text-red-400"
                    title="Remove view"
                  >
                    <Trash size={12} />
                  </button>
                </span>
              ))}
              {naming ? (
                <span className="flex items-center gap-1 border border-[#ff7a2f]/50 bg-[#171c22] pl-2">
                  <input
                    autoFocus
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveView()}
                    data-testid="view-name-input"
                    placeholder="Name…"
                    className="w-24 bg-transparent py-1.5 text-xs text-white outline-none placeholder:text-white/30"
                  />
                  <button
                    onClick={() => setShareChecked((c) => !c)}
                    data-testid="view-share-toggle"
                    title="Share with team"
                    className={`flex items-center gap-1 px-1.5 py-1.5 font-mono text-[10px] transition-colors ${
                      shareChecked ? "text-[#3b82f6]" : "text-white/40 hover:text-white"
                    }`}
                  >
                    <UsersThree size={13} weight={shareChecked ? "fill" : "regular"} /> Team
                  </button>
                  <button
                    onClick={saveView}
                    data-testid="save-view-btn"
                    className="bg-[#ff7a2f] px-2 py-1.5 font-mono text-[10px] font-bold text-[#0f1216]"
                  >
                    SAVE
                  </button>
                  <button
                    onClick={() => { setNaming(false); setViewName(""); setShareChecked(false); }}
                    className="px-1.5 py-1.5 text-white/40 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setNaming(true)}
                  data-testid="pin-view-btn"
                  className="flex items-center gap-1 border border-dashed border-white/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/50 transition-colors hover:border-[#ff7a2f]/50 hover:text-[#ff7a2f]"
                >
                  <Plus size={12} /> Pin current
                </button>
              )}
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 border border-white/10 bg-[#171c22] px-3 focus-within:border-[#ff7a2f] transition-colors">
                <MagnifyingGlass size={15} className="text-white/40" />
                <input
                  data-testid="ticket-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search order id or customer…"
                  className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/30"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    data-testid="ticket-search-clear"
                    className="text-white/40 hover:text-white"
                    title="Clear"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5" data-testid="ticket-sort">
                <ArrowsDownUp size={14} className="text-white/40" />
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSort(s.key)}
                    data-testid={`sort-${s.key}`}
                    className={`border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                      sort === s.key
                        ? "border-[#ff7a2f] bg-[#ff7a2f]/10 text-[#ff7a2f]"
                        : "border-white/10 text-white/50 hover:bg-white/5"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="dispatch-queue-grid">
              {loading ? (
                <Skeletons />
              ) : error ? (
                <ErrorState onRetry={load} />
              ) : filtered.length === 0 ? (
                <EmptyState text="No tickets match this filter." />
              ) : (
                filtered.map((t) => (
                  <TicketCard key={t.order_id} ticket={t} onUpdated={onTicketUpdated} onOverdue={handleOverdue} />
                ))
              )}
            </div>
          </>
        )}

        {tab === "fleet" && <FleetTracking />}

        {tab === "support" && <SupportDesk />}

        {tab === "ratings" && <RatingsModeration />}

        {tab === "stock" && (
          <>
            <div className="mb-5">
              <h1 className="font-head text-2xl font-extrabold tracking-tight text-white">
                Network Stock
              </h1>
              <p className="text-xs text-white/45">
                Live inventory across all supplier vendors
              </p>
            </div>

            {!loading && !error && (stockAlerts.out > 0 || stockAlerts.low > 0) && (
              <div
                data-testid="stock-alert-banner"
                className="mb-4 flex flex-wrap items-center gap-3 border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-4 py-3"
              >
                <Warning size={18} weight="fill" className="text-[#f59e0b]" />
                <p className="text-xs text-white/80">
                  <span className="font-semibold text-[#f59e0b]">{stockAlerts.out}</span> out of stock ·{" "}
                  <span className="font-semibold text-[#f59e0b]">{stockAlerts.low}</span> running low.
                  <span className="text-white/50"> Tap Reorder to raise a request.</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="network-stock-grid">
              {loading ? (
                <Skeletons count={6} />
              ) : error ? (
                <ErrorState onRetry={load} />
              ) : (stock || []).length === 0 ? (
                <EmptyState text="No stock data available." />
              ) : (
                stock.map((p) => <StockCard key={p.product_id} product={p} onReordered={() => load(true)} />)
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Store, ReceiptText, Truck, LifeBuoy, Star, LogOut, Menu, HardHat, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/vendors", label: "Vendors", icon: Store },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText },
  { to: "/admin/support", label: "Support", icon: LifeBuoy },
  { to: "/admin/ratings", label: "Ratings", icon: Star },
  { to: "/admin/logistics", label: "Logistics Rules", icon: Truck },
];

const TITLES = {
  "/admin": "Operations Overview",
  "/admin/vendors": "Vendor Management",
  "/admin/orders": "Recent Orders",
  "/admin/support": "Customer Support & Issues",
  "/admin/ratings": "Ratings Moderation",
  "/admin/logistics": "Logistics Rules",
};

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-cm-accent">
        <HardHat size={20} className="text-black" />
      </div>
      <div className="leading-tight">
        <div className="font-heading text-base font-700 tracking-tight text-cm-text">ConsMat</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-cm-muted">Admin Console</div>
      </div>
    </div>
  );
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1 px-2" data-testid="admin-nav">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          data-testid={`nav-${label.toLowerCase().split(" ")[0]}`}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-500 transition-colors ${
              isActive
                ? "bg-cm-accent/10 text-cm-accent"
                : "text-cm-muted hover:bg-cm-panel2 hover:text-cm-text"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={18} className={isActive ? "text-cm-accent" : ""} />
              <span>{label}</span>
              {isActive && <ChevronRight size={15} className="ml-auto text-cm-accent" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const title = TITLES[location.pathname] || "Admin Console";

  const initials = (user?.name || "A").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen bg-cm-bg text-cm-text">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-cm-border bg-cm-panel py-5 lg:flex">
        <div className="mb-8">
          <Brand />
        </div>
        <NavItems />
        <div className="mt-auto px-2">
          <div className="flex items-center gap-3 rounded-md border border-cm-border bg-cm-panel2 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-cm-accent/15 text-sm font-600 text-cm-accent">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-500 text-cm-text">{user?.name || "Admin"}</div>
              <div className="truncate text-xs text-cm-muted">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="logout-button"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-cm-border px-3 py-2 text-sm font-500 text-cm-muted transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-cm-border bg-cm-bg/90 px-4 py-3.5 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="grid h-9 w-9 place-items-center rounded-md border border-cm-border text-cm-muted lg:hidden"
                data-testid="mobile-menu-button"
              >
                <Menu size={18} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-cm-border bg-cm-panel p-0 pt-6 text-cm-text">
              <SheetTitle className="sr-only">ConsMat Admin navigation</SheetTitle>
              <SheetDescription className="sr-only">Primary navigation menu</SheetDescription>
              <div className="mb-6">
                <Brand />
              </div>
              <NavItems onNavigate={() => setOpen(false)} />
              <div className="mt-6 px-2">
                <button
                  onClick={() => { setOpen(false); logout(); }}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-cm-border px-3 py-2 text-sm text-cm-muted hover:text-red-400"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <h1 className="truncate font-heading text-lg font-600 tracking-tight text-cm-text md:text-xl" data-testid="page-title">
              {title}
            </h1>
          </div>
          <div className="ml-auto hidden items-center gap-2 rounded-full border border-cm-border bg-cm-panel px-3 py-1.5 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-cm-muted">Live · admin</span>
          </div>
        </header>

        <main className="relative flex-1 px-4 py-5 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

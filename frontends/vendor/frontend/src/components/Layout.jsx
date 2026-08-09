import { useNavigate } from "react-router-dom";
import { LogOut, Store, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import ApiConfigDialog from "@/components/ApiConfigDialog";

export const Layout = ({ children, lowStockCount = 0 }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#0f1216] text-white font-sans">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#171c22]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#ff7a2f]/15 text-[#ff7a2f]">
              <Store size={18} />
            </div>
            <div className="leading-tight">
              <p className="font-heading text-sm font-extrabold tracking-tight sm:text-base">
                Vendor<span className="text-[#ff7a2f]">Hub</span>
              </p>
              <p className="hidden text-[11px] text-[#94a3b8] sm:block">Seller Console</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {isAuthenticated && lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("open-bulk-restock"))}
                data-testid="header-low-stock-badge"
                className="flex items-center gap-1 rounded-md bg-[#ef4444]/15 px-2 py-1 text-xs font-semibold text-[#ef4444] transition-colors duration-200 hover:bg-[#ef4444]/25"
                title={`${lowStockCount} item(s) need restocking — tap to restock`}
              >
                <AlertTriangle size={12} /> {lowStockCount}
                <span className="hidden sm:inline">&nbsp;low</span>
              </button>
            )}
            <ApiConfigDialog />
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="logout-btn"
                className="text-[#94a3b8] hover:text-white hover:bg-white/5"
              >
                <LogOut size={16} className="mr-1.5" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
};

export default Layout;

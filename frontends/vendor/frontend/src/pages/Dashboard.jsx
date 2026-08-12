import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { getVendorMe, getVendorOrders, getApiBase, getLowStockThreshold } from "@/lib/api";
import { pick, getOfferStock } from "@/lib/format";
import Layout from "@/components/Layout";
import ProfileHeader from "@/components/ProfileHeader";
import SalesSnapshot from "@/components/SalesSnapshot";
import TopProducts from "@/components/TopProducts";
import SalesByCategory from "@/components/SalesByCategory";
import InventoryTable from "@/components/InventoryTable";
import OrdersList from "@/components/OrdersList";
import ReviewsReceived from "@/components/ReviewsReceived";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { playChime } from "@/lib/sound";

const ErrorPanel = ({ error, onRetry }) => (
  <div className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-5" data-testid="dashboard-error">
    <div className="flex items-start gap-3">
      <AlertCircle size={20} className="mt-0.5 shrink-0 text-[#ef4444]" />
      <div className="flex-1">
        <p className="font-semibold text-white">Couldn't load data</p>
        <p className="mt-1 text-sm text-[#94a3b8]">
          {error?.response?.data?.detail || error?.message || "Request failed."}
          {!getApiBase() && " Backend URL is not configured — tap the API button above."}
        </p>
        <Button size="sm" onClick={onRetry} className="mt-3 bg-[#ff7a2f] text-[#0f1216] hover:brightness-110">
          <RefreshCw size={14} className="mr-1.5" /> Retry
        </Button>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const meQuery = useQuery({
    queryKey: ["vendor-me"],
    queryFn: async () => (await getVendorMe()).data,
  });

  const ordersQuery = useQuery({
    queryKey: ["vendor-orders"],
    queryFn: async () => (await getVendorOrders()).data,
    refetchInterval: 30000,
  });

  const vendor = meQuery.data?.vendor || meQuery.data || {};
  const offers = pick(vendor, ["offers", "inventory", "products", "items"], []) || [];
  const ordersRaw = ordersQuery.data;
  const orders = Array.isArray(ordersRaw)
    ? ordersRaw
    : pick(ordersRaw, ["orders", "results", "data", "items"], []) || [];

  const lowStockCount = offers.filter(
    (o) => Number(getOfferStock(o)) <= getLowStockThreshold()
  ).length;

  const prevOrderCount = useRef(null);
  useEffect(() => {
    if (!ordersQuery.isSuccess) return;
    const n = orders.length;
    if (prevOrderCount.current !== null && n > prevOrderCount.current) {
      const diff = n - prevOrderCount.current;
      playChime();
      toast.success(`${diff} new order${diff > 1 ? "s" : ""} received!`, {
        description: "Check the Incoming Orders panel.",
      });
    }
    prevOrderCount.current = n;
  }, [orders.length, ordersQuery.isSuccess]);

  return (
    <Layout lowStockCount={lowStockCount}>
      <div className="space-y-5 sm:space-y-6" data-testid="vendor-dashboard">
        {meQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg bg-[#171c22]" />
            <Skeleton className="h-64 w-full rounded-lg bg-[#171c22]" />
          </div>
        ) : meQuery.isError ? (
          <ErrorPanel error={meQuery.error} onRetry={() => meQuery.refetch()} />
        ) : (
          <>
            <ProfileHeader vendor={vendor} />
            {!ordersQuery.isError && <SalesSnapshot orders={orders} />}
            {!ordersQuery.isError && (
              <div className="grid gap-4 lg:grid-cols-2">
                <TopProducts orders={orders} offers={offers} />
                <SalesByCategory orders={orders} offers={offers} />
              </div>
            )}
            <ReviewsReceived vendorId={vendor.id} />
            <InventoryTable offers={offers} />
          </>
        )}

        {ordersQuery.isLoading ? (
          <Skeleton className="h-48 w-full rounded-lg bg-[#171c22]" />
        ) : ordersQuery.isError ? (
          <ErrorPanel error={ordersQuery.error} onRetry={() => ordersQuery.refetch()} />
        ) : (
          <OrdersList orders={orders} />
        )}
      </div>
    </Layout>
  );
}

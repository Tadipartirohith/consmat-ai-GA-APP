import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, ShieldCheck, CheckCircle2, Store, Download, ChevronRight, X } from "lucide-react";
import { api, apiErrorMessage, compactINR } from "@/lib/api";
import { StarRating } from "@/components/StarRating";
import { VendorDrawer } from "@/components/VendorDrawer";
import { exportToCsv } from "@/lib/csv";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

function KycBadge({ status }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-500 text-emerald-400">
        <CheckCircle2 size={12} /> Approved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-500 text-yellow-400">
      Pending
    </span>
  );
}

export default function Vendors() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [approvingId, setApprovingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const vendorsQ = useQuery({ queryKey: ["vendors"], queryFn: async () => (await api.get("/admin/vendors")).data });

  const approve = useMutation({
    mutationFn: async (id) => (await api.post(`/admin/vendors/${id}/approve`)).data,
    onMutate: (id) => setApprovingId(id),
    onSuccess: (data) => {
      toast.success("KYC approved", { description: `${data.name} is now an active vendor.` });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendor", data.id] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
    onError: (e) => toast.error("Approval failed", { description: apiErrorMessage(e) }),
    onSettled: () => setApprovingId(null),
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids) => (await api.post("/admin/vendors/bulk-approve", { ids })).data,
    onSuccess: (data) => {
      toast.success("Bulk KYC approved", { description: `${data.approved} vendor(s) activated.` });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
    onError: (e) => toast.error("Bulk approval failed", { description: apiErrorMessage(e) }),
  });

  const openVendor = (id) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  const vendors = (vendorsQ.data || []).filter((v) => {
    const s = q.toLowerCase();
    return !s || v.name.toLowerCase().includes(s) || v.category.toLowerCase().includes(s) || v.city.toLowerCase().includes(s);
  });

  const pendingIds = vendors.filter((v) => v.kyc_status === "pending").map((v) => v.id);
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllPending = () => {
    setSelected(() => (allPendingSelected ? new Set() : new Set(pendingIds)));
  };

  const exportCsv = () => {
    exportToCsv(
      "consmat-vendors.csv",
      [
        { label: "Vendor ID", value: "id" },
        { label: "Name", value: "name" },
        { label: "Category", value: "category" },
        { label: "City", value: "city" },
        { label: "Rating", value: "rating" },
        { label: "KYC Status", value: "kyc_status" },
        { label: "GMV (INR)", value: "gmv" },
        { label: "Orders", value: "orders" },
        { label: "Contact", value: "contact" },
        { label: "Phone", value: (r) => r.phone },
        { label: "GSTIN", value: (r) => r.gstin },
      ],
      vendors,
    );
    toast.success("Exported vendors", { description: `${vendors.length} rows downloaded as CSV.` });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-cm-muted">
          {vendorsQ.data ? `${vendorsQ.data.length} vendors · ${vendorsQ.data.filter((v) => v.kyc_status === "pending").length} pending KYC` : "Loading vendors…"}
        </p>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cm-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, category, city…"
              data-testid="vendor-search-input"
              className="border-cm-border bg-cm-panel pl-9 text-cm-text placeholder:text-cm-muted focus-visible:ring-cm-accent"
            />
          </div>
          <button
            onClick={exportCsv}
            data-testid="export-vendors-csv"
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-cm-border bg-cm-panel px-3 py-2 text-sm font-500 text-cm-muted transition-colors hover:border-cm-accent/40 hover:text-cm-accent"
          >
            <Download size={15} /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            data-testid="bulk-action-bar"
            className="flex flex-wrap items-center gap-3 rounded-md border border-cm-accent/30 bg-cm-accent/10 px-4 py-3"
          >
            <span className="text-sm font-500 text-cm-text" data-testid="bulk-selected-count">
              {selected.size} vendor{selected.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={() => bulkApprove.mutate(Array.from(selected))}
              disabled={bulkApprove.isPending}
              data-testid="bulk-approve-button"
              className="ml-auto inline-flex items-center gap-2 rounded-md bg-cm-accent px-4 py-1.5 text-sm font-600 text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {bulkApprove.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Approve {selected.size} Selected
            </button>
            <button
              onClick={() => setSelected(new Set())}
              data-testid="bulk-clear-button"
              className="inline-flex items-center gap-1 rounded-md border border-cm-border px-3 py-1.5 text-sm text-cm-muted transition-colors hover:text-cm-text"
            >
              <X size={14} /> Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-lg border border-cm-border bg-cm-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm" data-testid="vendors-table">
            <thead>
              <tr className="border-b border-cm-border text-left text-xs uppercase tracking-wide text-cm-muted">
                <th className="w-12 px-5 py-3">
                  <Checkbox
                    checked={allPendingSelected}
                    disabled={pendingIds.length === 0}
                    onCheckedChange={toggleAllPending}
                    data-testid="select-all-pending"
                    className="border-cm-border data-[state=checked]:border-cm-accent data-[state=checked]:bg-cm-accent"
                  />
                </th>
                <th className="px-5 py-3 font-500">Vendor</th>
                <th className="px-5 py-3 font-500">Category</th>
                <th className="px-5 py-3 font-500">Rating</th>
                <th className="px-5 py-3 font-500 text-right">GMV</th>
                <th className="px-5 py-3 font-500">KYC</th>
                <th className="px-5 py-3 font-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {vendorsQ.isLoading && (
                <tr><td colSpan={7} className="py-14 text-center text-cm-muted"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr>
              )}
              {vendorsQ.isError && (
                <tr><td colSpan={7} className="py-14 text-center text-red-300">Failed to load vendors.</td></tr>
              )}
              {!vendorsQ.isLoading && vendors.length === 0 && (
                <tr><td colSpan={7} className="py-14 text-center text-cm-muted">No vendors match your search.</td></tr>
              )}
              {vendors.map((v, i) => {
                const isPending = v.kyc_status === "pending";
                return (
                  <motion.tr
                    key={v.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    data-testid={`vendor-row-${v.id}`}
                    onClick={() => openVendor(v.id)}
                    className={`cursor-pointer border-b border-cm-border/60 transition-colors last:border-0 hover:bg-cm-panel2/50 ${selected.has(v.id) ? "bg-cm-accent/5" : ""}`}
                  >
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {isPending ? (
                        <Checkbox
                          checked={selected.has(v.id)}
                          onCheckedChange={() => toggleOne(v.id)}
                          data-testid={`vendor-checkbox-${v.id}`}
                          className="border-cm-border data-[state=checked]:border-cm-accent data-[state=checked]:bg-cm-accent"
                        />
                      ) : (
                        <span className="block h-4 w-4" />
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-cm-panel2 text-cm-muted">
                          <Store size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-500 text-cm-text">{v.name}</div>
                          <div className="truncate text-xs text-cm-muted">{v.city} · {v.contact}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-cm-muted">{v.category}</td>
                    <td className="px-5 py-3.5"><StarRating value={v.rating} size={13} /></td>
                    <td className="px-5 py-3.5 text-right font-mono text-cm-text">{compactINR(v.gmv)}</td>
                    <td className="px-5 py-3.5"><KycBadge status={v.kyc_status} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isPending ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); approve.mutate(v.id); }}
                            disabled={approvingId === v.id}
                            data-testid={`approve-kyc-button-${v.id}`}
                            className="inline-flex items-center gap-1.5 rounded-md bg-cm-accent px-3 py-1.5 text-xs font-600 text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
                          >
                            {approvingId === v.id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                            Approve KYC
                          </button>
                        ) : (
                          <span className="text-xs text-cm-muted">—</span>
                        )}
                        <ChevronRight size={16} className="text-cm-muted" />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <VendorDrawer
        vendorId={selectedId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onApprove={(id) => approve.mutate(id)}
        approving={approvingId === selectedId}
      />
    </div>
  );
}

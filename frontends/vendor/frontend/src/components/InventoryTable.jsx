import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X, AlertTriangle, Package, SlidersHorizontal, Loader2, Search, Plus, Filter, PackagePlus, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  updateOffer,
  createOffer,
  getLowStockThreshold,
  setLowStockThreshold,
  getRestockPreset,
  setRestockPreset,
} from "@/lib/api";
import { formatINR, getOfferName, getOfferPrice, getOfferStock, getOfferCategory, getOfferImage, getOfferId } from "@/lib/format";
import ImagePicker from "@/components/ImagePicker";
import { toast } from "sonner";

const Thumb = ({ src, size = 34 }) => {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#0f1216] text-[#94a3b8]"
        style={{ width: size, height: size }}
      >
        <Package size={16} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setErr(true)}
      className="shrink-0 rounded-md border border-white/10 object-cover"
      style={{ width: size, height: size }}
    />
  );
};

const AddOfferDialog = ({ onAdded }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", stock: "", image: "" });

  const mutation = useMutation({
    mutationFn: () =>
      createOffer({
        name: form.name.trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        image_url: form.image.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`Added "${form.name.trim()}"`);
      setForm({ name: "", price: "", stock: "", image: "" });
      setOpen(false);
      onAdded?.();
    },
    onError: (err) =>
      toast.error(err?.response?.data?.detail || err.message || "Failed to add product"),
  });

  const canSubmit = form.name.trim() && form.price !== "" && form.stock !== "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          data-testid="add-offer-btn"
          className="bg-[#ff7a2f] font-semibold text-[#0f1216] hover:brightness-110"
        >
          <Plus size={15} className="mr-1.5" /> Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#171c22] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-tight">Add Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-[#94a3b8]">Product name</Label>
            <Input
              data-testid="add-offer-name-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Basmati Rice 5kg"
              className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[#94a3b8]">Price (₹)</Label>
              <Input
                type="number"
                data-testid="add-offer-price-input"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="450"
                className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#94a3b8]">Stock</Label>
              <Input
                type="number"
                data-testid="add-offer-stock-input"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                placeholder="100"
                className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[#94a3b8]">Photo (optional)</Label>
            <ImagePicker
              value={form.image}
              onChange={(v) => setForm((f) => ({ ...f, image: v }))}
              testidPrefix="add-offer-image"
              size={40}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            data-testid="submit-add-offer-btn"
            className="bg-[#ff7a2f] font-semibold text-[#0f1216] hover:brightness-110"
          >
            {mutation.isPending ? (
              <Loader2 size={15} className="mr-1.5 animate-spin" />
            ) : (
              <Plus size={15} className="mr-1.5" />
            )}
            Add Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const BulkRestockDialog = ({ offers, threshold, onDone }) => {
  const [open, setOpen] = useState(false);
  const preset = getRestockPreset();
  const [target, setTarget] = useState(
    String(preset ?? Math.max(threshold * 2, threshold + 10))
  );
  const [saveDefault, setSaveDefault] = useState(preset != null);
  const [busy, setBusy] = useState(false);

  const lowItems = offers.filter((o) => Number(getOfferStock(o)) <= threshold);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-bulk-restock", handler);
    return () => window.removeEventListener("open-bulk-restock", handler);
  }, []);

  const restock = async () => {
    const t = Number(target);
    if (!Number.isFinite(t) || t <= 0) {
      toast.error("Enter a valid stock level");
      return;
    }
    if (saveDefault) setRestockPreset(t);
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const o of lowItems) {
      try {
        await updateOffer({ ...o, id: getOfferId(o), stock: t });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBusy(false);
    setOpen(false);
    if (ok) toast.success(`Restocked ${ok} item${ok !== 1 ? "s" : ""} to ${t} units`);
    if (fail) toast.error(`${fail} item${fail !== 1 ? "s" : ""} failed to restock`);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          data-testid="bulk-restock-btn"
          className="border-[#ff7a2f]/40 bg-[#ff7a2f]/10 text-[#ff7a2f] transition-colors duration-200 hover:bg-[#ff7a2f]/20"
        >
          <PackagePlus size={15} className="mr-1.5" /> Restock ({lowItems.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#171c22] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-tight">Bulk Restock Low Stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-[#94a3b8]">
            {lowItems.length} item{lowItems.length !== 1 ? "s" : ""} at or below{" "}
            <span className="text-[#ff7a2f]">{threshold}</span> units will be set to the level below.
            {preset != null && (
              <span className="ml-1" data-testid="restock-preset-note">
                Using your default of <span className="text-[#ff7a2f]">{preset}</span>.
              </span>
            )}
          </p>
          <div className="space-y-1.5">
            <Label className="text-[#94a3b8]">Set stock to</Label>
            <Input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              data-testid="bulk-restock-target-input"
              className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#94a3b8]">
            <Checkbox
              checked={saveDefault}
              onCheckedChange={(v) => setSaveDefault(!!v)}
              data-testid="save-restock-preset-checkbox"
              className="border-white/20 data-[state=checked]:border-[#ff7a2f] data-[state=checked]:bg-[#ff7a2f] data-[state=checked]:text-[#0f1216]"
            />
            Save as my default restock level
          </label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-white/10 bg-[#0f1216] p-2">
            {lowItems.map((o, i) => (
              <div key={getOfferId(o) ?? i} className="flex items-center justify-between text-xs text-[#94a3b8]">
                <span className="truncate">{getOfferName(o)}</span>
                <span className="tabular-nums">
                  <span className="text-[#ef4444]">{getOfferStock(o)}</span> → <span className="text-[#ff7a2f]">{target}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={busy || lowItems.length === 0}
            onClick={restock}
            data-testid="confirm-bulk-restock-btn"
            className="bg-[#ff7a2f] font-semibold text-[#0f1216] hover:brightness-110"
          >
            {busy ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <PackagePlus size={15} className="mr-1.5" />}
            Restock All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditableRow = ({ offer, threshold, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(getOfferName(offer));
  const [category, setCategory] = useState(getOfferCategory(offer));
  const [image, setImage] = useState(getOfferImage(offer));
  const [price, setPrice] = useState(getOfferPrice(offer));
  const [stock, setStock] = useState(getOfferStock(offer));

  const currentStock = getOfferStock(offer);
  const isLow = Number(currentStock) <= threshold;
  const rowKey = getOfferId(offer) ?? getOfferName(offer);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...offer,
        id: getOfferId(offer),
        name: name.trim(),
        category: category.trim(),
        image_url: image.trim(),
        price: Number(price),
        stock: Number(stock),
      };
      return updateOffer(payload);
    },
    onSuccess: () => {
      toast.success(`Updated "${name.trim()}"`);
      setEditing(false);
      onSaved?.();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail || err.message || "Failed to update offer");
    },
  });

  const cancel = () => {
    setName(getOfferName(offer));
    setCategory(getOfferCategory(offer));
    setImage(getOfferImage(offer));
    setPrice(getOfferPrice(offer));
    setStock(getOfferStock(offer));
    setEditing(false);
  };

  return (
    <TableRow
      className={`border-white/10 transition-colors duration-200 hover:bg-white/[0.03] ${
        isLow ? "bg-[#ef4444]/[0.06]" : ""
      }`}
      data-testid={`offer-row-${rowKey}`}
    >
      <TableCell className="font-medium text-white">
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid={`offer-name-input-${rowKey}`}
              placeholder="Product name"
              className="h-8 min-w-[150px] bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
            />
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              data-testid={`offer-category-input-${rowKey}`}
              placeholder="Category"
              className="h-7 min-w-[150px] bg-[#0f1216] border-white/10 text-xs text-[#94a3b8] focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
            />
            <ImagePicker value={image} onChange={setImage} testidPrefix={`offer-image-${rowKey}`} size={28} compact />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Thumb src={getOfferImage(offer)} />
            <div className="min-w-0">
              <span className="block truncate">{getOfferName(offer)}</span>
              {getOfferCategory(offer) && (
                <span className="block truncate text-xs text-[#94a3b8]" data-testid={`offer-category-${rowKey}`}>
                  {getOfferCategory(offer)}
                </span>
              )}
            </div>
          </div>
        )}
      </TableCell>

      <TableCell className="text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <span className="text-[#94a3b8]">₹</span>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              data-testid={`offer-price-input-${rowKey}`}
              className="h-8 w-24 bg-[#0f1216] border-white/10 text-right text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
            />
          </div>
        ) : (
          <span className="tabular-nums" data-testid={`offer-price-${rowKey}`}>
            {formatINR(getOfferPrice(offer))}
          </span>
        )}
      </TableCell>

      <TableCell className="text-right">
        {editing ? (
          <Input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            data-testid={`offer-stock-input-${rowKey}`}
            className="ml-auto h-8 w-20 bg-[#0f1216] border-white/10 text-right text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
          />
        ) : (
          <div className="flex items-center justify-end gap-2">
            <span
              className={`tabular-nums ${isLow ? "font-semibold text-[#ef4444]" : "text-white"}`}
              data-testid={`offer-stock-${rowKey}`}
            >
              {currentStock}
            </span>
            {isLow && (
              <Badge
                className="border-0 bg-[#ef4444]/15 text-[11px] text-[#ef4444] hover:bg-[#ef4444]/20"
                data-testid={`low-stock-flag-${rowKey}`}
              >
                <AlertTriangle size={11} className="mr-1" /> Low
              </Badge>
            )}
          </div>
        )}
      </TableCell>

      <TableCell className="text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              data-testid={`save-offer-btn-${rowKey}`}
              className="h-8 w-8 bg-[#ff7a2f] text-[#0f1216] hover:brightness-110"
            >
              {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={cancel}
              data-testid={`cancel-offer-btn-${rowKey}`}
              className="h-8 w-8 text-[#94a3b8] hover:bg-white/5 hover:text-white"
            >
              <X size={15} />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            data-testid={`edit-offer-btn-${rowKey}`}
            className="text-[#94a3b8] hover:bg-white/5 hover:text-[#ff7a2f]"
          >
            <Pencil size={14} className="mr-1.5" /> Edit
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};

export const InventoryTable = ({ offers = [] }) => {
  const queryClient = useQueryClient();
  const [threshold, setThreshold] = useState(getLowStockThreshold());
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const applyThreshold = (v) => {
    const n = Math.max(0, parseInt(v, 10) || 0);
    setThreshold(n);
    setLowStockThreshold(n);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["vendor-me"] });

  const lowCount = offers.filter((o) => Number(getOfferStock(o)) <= threshold).length;

  const categories = useMemo(
    () => Array.from(new Set(offers.map((o) => getOfferCategory(o)).filter(Boolean))).sort(),
    [offers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offers.filter((o) => {
      const matchesSearch = !q || getOfferName(o).toLowerCase().includes(q);
      const matchesLow = !lowOnly || Number(getOfferStock(o)) <= threshold;
      const matchesCategory = categoryFilter === "all" || getOfferCategory(o) === categoryFilter;
      return matchesSearch && matchesLow && matchesCategory;
    });
  }, [offers, search, lowOnly, threshold, categoryFilter]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const val = (o) =>
      sort.key === "name"
        ? getOfferName(o).toLowerCase()
        : sort.key === "price"
        ? Number(getOfferPrice(o))
        : Number(getOfferStock(o));
    const arr = [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const SortIcon = ({ k }) =>
    sort.key !== k ? (
      <ArrowUpDown size={13} className="opacity-40" />
    ) : sort.dir === "asc" ? (
      <ArrowUp size={13} className="text-[#ff7a2f]" />
    ) : (
      <ArrowDown size={13} className="text-[#ff7a2f]" />
    );

  const exportCsv = () => {
    const rows = [
      ["Name", "Category", "Price (INR)", "Stock"],
      ...offers.map((o) => [getOfferName(o), getOfferCategory(o), getOfferPrice(o), getOfferStock(o)]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Inventory exported to CSV");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-lg border border-white/10 bg-[#171c22]"
      data-testid="inventory-panel"
    >
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold tracking-tight">Inventory</h2>
            <p className="text-sm text-[#94a3b8]">
              {offers.length} item{offers.length !== 1 ? "s" : ""}
              {lowCount > 0 && <span className="text-[#ef4444]"> · {lowCount} low stock</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportCsv}
              disabled={offers.length === 0}
              data-testid="export-inventory-btn"
              className="border-white/10 bg-[#0f1216] text-[#94a3b8] transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              <Download size={15} className="mr-1.5" /> Export
            </Button>
            {lowCount > 0 && <BulkRestockDialog offers={offers} threshold={threshold} onDone={refresh} />}
            <AddOfferDialog onAdded={refresh} />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="inventory-search-input"
              placeholder="Search products…"
              className="pl-9 bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {categories.length > 0 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger
                  data-testid="category-filter-select"
                  className="h-9 w-[160px] border-white/10 bg-[#0f1216] text-white focus:ring-1 focus:ring-[#ff7a2f]"
                >
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#171c22] text-white">
                  <SelectItem value="all" data-testid="category-option-all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c} data-testid={`category-option-${c}`}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLowOnly((v) => !v)}
              data-testid="low-stock-filter-toggle"
              className={`border-white/10 transition-colors duration-200 ${
                lowOnly
                  ? "bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/20"
                  : "bg-[#0f1216] text-[#94a3b8] hover:bg-white/5"
              }`}
            >
              <Filter size={14} className="mr-1.5" /> Low stock
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#0f1216] px-3 py-1.5">
              <SlidersHorizontal size={14} className="text-[#ff7a2f]" />
              <span className="whitespace-nowrap text-xs text-[#94a3b8]">≤</span>
              <Input
                type="number"
                value={threshold}
                onChange={(e) => applyThreshold(e.target.value)}
                data-testid="low-stock-threshold-input"
                className="h-7 w-14 border-white/10 bg-[#171c22] text-center text-sm text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
              />
            </div>
          </div>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center" data-testid="inventory-empty">
          <Package size={32} className="text-white/20" />
          <div>
            <p className="font-medium text-white">No products yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#94a3b8]">
              Add your first product to start selling. You can edit its price, stock, name and category anytime.
            </p>
          </div>
          <AddOfferDialog onAdded={refresh} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-14 text-center" data-testid="inventory-no-results">
          <Search size={32} className="text-white/20" />
          <p className="text-[#94a3b8]">No products match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-[#94a3b8]">
                  <button
                    onClick={() => toggleSort("name")}
                    data-testid="sort-by-name"
                    className="inline-flex items-center gap-1 transition-colors duration-200 hover:text-white"
                  >
                    Product <SortIcon k="name" />
                  </button>
                </TableHead>
                <TableHead className="text-right text-[#94a3b8]">
                  <button
                    onClick={() => toggleSort("price")}
                    data-testid="sort-by-price"
                    className="ml-auto inline-flex items-center gap-1 transition-colors duration-200 hover:text-white"
                  >
                    Price <SortIcon k="price" />
                  </button>
                </TableHead>
                <TableHead className="text-right text-[#94a3b8]">
                  <button
                    onClick={() => toggleSort("stock")}
                    data-testid="sort-by-stock"
                    className="ml-auto inline-flex items-center gap-1 transition-colors duration-200 hover:text-white"
                  >
                    Stock <SortIcon k="stock" />
                  </button>
                </TableHead>
                <TableHead className="w-[120px] text-right text-[#94a3b8]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((offer, i) => (
                <EditableRow
                  key={getOfferId(offer) ?? i}
                  offer={offer}
                  threshold={threshold}
                  onSaved={refresh}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </motion.div>
  );
};

export default InventoryTable;

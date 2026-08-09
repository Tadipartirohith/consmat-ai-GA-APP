import React, { useState } from "react";
import { estimate } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { formatINR, formatNumber, titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calculator, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function EstimateMode() {
  const { location, addManyToCart } = useApp();
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [bom, setBom] = useState(null);
  const [meta, setMeta] = useState(null);

  const run = async () => {
    if (!description.trim() && !area.trim()) {
      toast.error("Describe your project or enter an area.");
      return;
    }
    setLoading(true);
    setBom(null);
    try {
      const data = await estimate({
        description,
        area: area ? Number(area) : undefined,
        location,
      });
      const items = Array.isArray(data) ? data : data?.items || data?.bom || data?.materials || [];
      setBom(items);
      setMeta({
        total: data?.total ?? data?.total_cost,
        note: data?.note || data?.summary,
      });
    } catch (e) {
      toast.error("Estimate failed. Backend not reachable.");
      setBom([]);
    } finally {
      setLoading(false);
    }
  };

  const addAll = () => {
    if (!bom || !bom.length) return;
    addManyToCart(
      bom.map((it) => ({
        material: it.material || it.name || it.item,
        quantity: it.quantity || it.qty || 1,
        unit: it.unit || it.uom || "units",
        price: it.price ?? it.cost ?? it.amount,
      }))
    );
  };

  const g = (it, keys, fb) => {
    for (const k of keys) if (it?.[k] !== undefined && it?.[k] !== null) return it[k];
    return fb;
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="font-head text-2xl font-bold tracking-tight">Project estimate</h2>
        <p className="text-sm text-white/50">
          Describe your build and get an auto-generated bill of materials.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-white/10 bg-[#171c22] p-5 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <Textarea
            data-testid="estimate-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Ground + 1 residential house, 2000 sq ft, RCC frame structure..."
            className="min-h-[96px] border-white/10 bg-[#0f1216]"
          />
          <div className="max-w-[180px]">
            <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-white/40">
              Built-up area (sq ft)
            </label>
            <Input
              data-testid="estimate-area"
              type="number"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="2000"
              className="border-white/10 bg-[#0f1216]"
            />
          </div>
        </div>
        <div className="flex items-end">
          <Button
            data-testid="estimate-generate-btn"
            onClick={run}
            disabled={loading}
            className="w-full bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822] md:w-auto"
          >
            <Calculator size={16} className="mr-1.5" />
            {loading ? "Estimating..." : "Generate BOM"}
          </Button>
        </div>
      </div>

      {bom && bom.length > 0 && (
        <div className="mt-6 animate-fade-up">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#ff7a2f]" />
              <h3 className="font-head text-lg font-bold">Bill of Materials</h3>
            </div>
            <Button
              data-testid="estimate-add-all-btn"
              onClick={addAll}
              className="bg-[#ff7a2f] text-black hover:bg-[#e66822]"
              size="sm"
            >
              <ShoppingCart size={15} className="mr-1.5" /> Add all to cart
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 bg-[#0f1216] hover:bg-[#0f1216]">
                  <TableHead className="text-white/60">Material</TableHead>
                  <TableHead className="text-right text-white/60">Quantity</TableHead>
                  <TableHead className="text-white/60">Unit</TableHead>
                  <TableHead className="text-right text-white/60">Est. cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bom.map((it, i) => (
                  <TableRow key={i} data-testid={`bom-row-${i}`} className="border-white/10 bg-[#171c22]">
                    <TableCell className="font-medium">
                      {titleCase(g(it, ["material", "name", "item"], "—"))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(g(it, ["quantity", "qty"], "—"))}
                    </TableCell>
                    <TableCell className="text-white/60">{g(it, ["unit", "uom"], "—")}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatINR(g(it, ["price", "cost", "amount"]))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {meta?.total !== undefined && meta?.total !== null && (
            <div className="mt-3 flex justify-end">
              <div className="rounded-lg border border-white/10 bg-[#171c22] px-5 py-3">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">Total </span>
                <span className="ml-2 font-mono text-xl font-bold text-[#ff7a2f]">
                  {formatINR(meta.total)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {bom && bom.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-white/10 bg-[#171c22] py-10 text-center text-sm text-white/50">
          No bill of materials returned.
        </p>
      )}
    </div>
  );
}

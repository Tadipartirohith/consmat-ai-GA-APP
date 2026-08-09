import { useState } from "react";
import { Settings2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getApiBase, setApiBase } from "@/lib/api";
import { toast } from "sonner";

export const ApiConfigDialog = ({ trigger }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(getApiBase());

  const save = () => {
    setApiBase(value);
    toast.success("API base URL saved");
    setOpen(false);
    // reload so interceptors + queries pick up the new base
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            data-testid="open-api-config-btn"
            className="text-[#94a3b8] hover:text-white hover:bg-white/5"
          >
            <Settings2 size={16} className="mr-1.5" /> API
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#171c22] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-tight">Backend API Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="api-base" className="text-[#94a3b8]">
            API Base URL
          </Label>
          <Input
            id="api-base"
            data-testid="api-base-input"
            placeholder="https://your-backend.example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
          />
          <p className="text-xs text-[#94a3b8]">
            The app calls <span className="text-[#ff7a2f]">{"{base}"}/api/v1</span>. OpenAPI is at
            <span className="text-[#ff7a2f]"> {"{base}"}/openapi.json</span>.
          </p>
        </div>
        <DialogFooter>
          <Button
            onClick={save}
            data-testid="save-api-config-btn"
            className="bg-[#ff7a2f] hover:brightness-110 text-[#0f1216] font-semibold"
          >
            <Check size={16} className="mr-1.5" /> Save & Reload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApiConfigDialog;

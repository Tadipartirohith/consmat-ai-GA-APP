import { useRef, useState } from "react";
import { Upload, Loader2, Package, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resizeImageFile } from "@/lib/image";
import { toast } from "sonner";

const Thumb = ({ src, size }) => {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#0f1216] text-[#94a3b8]"
        style={{ width: size, height: size }}
      >
        <Package size={Math.round(size * 0.45)} />
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

export const ImagePicker = ({ value, onChange, testidPrefix = "image", size = 40, compact = false }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setBusy(true);
    try {
      onChange(await resizeImageFile(file));
    } catch {
      toast.error("Couldn't process that image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Thumb src={value} size={size} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
        data-testid={`${testidPrefix}-file-input`}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        data-testid={`${testidPrefix}-upload-btn`}
        className="border-white/10 bg-[#0f1216] text-[#94a3b8] transition-colors duration-200 hover:bg-white/5 hover:text-white"
      >
        {busy ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
        {compact ? "" : "Upload"}
      </Button>
      {!compact && (
        <Input
          value={value?.startsWith("data:") ? "" : value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="or paste image URL"
          data-testid={`${testidPrefix}-url-input`}
          className="flex-1 bg-[#0f1216] border-white/10 text-sm text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
        />
      )}
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          data-testid={`${testidPrefix}-clear-btn`}
          className="h-8 w-8 shrink-0 text-[#94a3b8] hover:bg-white/5 hover:text-white"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
};

export default ImagePicker;

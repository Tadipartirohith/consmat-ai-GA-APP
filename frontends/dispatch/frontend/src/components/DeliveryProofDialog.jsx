import { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Signature, Trash, CheckCircle, CircleNotch, UploadSimple } from "@phosphor-icons/react";

function downscale(dataUrl, max = 700, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) {
        const r = Math.min(max / width, max / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      c.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0f1216";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#ff7a2f";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return {
      x: (p.clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (p.clientY - rect.top) * (canvasRef.current.height / rect.height),
    };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onChange(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0f1216";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={520}
        height={200}
        data-testid="signature-canvas"
        className="w-full cursor-crosshair touch-none border border-white/10 bg-[#0f1216]"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button
        onClick={clear}
        data-testid="signature-clear-btn"
        className="mt-2 flex items-center gap-1 font-mono text-[11px] text-white/50 hover:text-red-400"
      >
        <Trash size={12} /> Clear signature
      </button>
    </div>
  );
}

export default function DeliveryProofDialog({ open, onOpenChange, orderId, onConfirm }) {
  const [mode, setMode] = useState("photo");
  const [proof, setProof] = useState(null);
  const [proofType, setProofType] = useState("photo");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const reset = () => {
    setProof(null);
    setNote("");
    setMode("photo");
    setProofType("photo");
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const scaled = await downscale(reader.result);
      setProof(scaled);
      setProofType("photo");
    };
    reader.readAsDataURL(file);
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm({ proof, proof_type: proofType, note: note.trim() || null });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        data-testid="delivery-proof-dialog"
        className="border border-white/10 bg-[#171c22] text-white sm:max-w-lg [&>button]:text-white/50"
      >
        <DialogHeader>
          <DialogTitle className="font-head tracking-tight">
            Confirm delivery · <span className="font-mono text-[#ff7a2f]">{orderId}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setMode("photo"); setProof(null); setProofType("photo"); }}
            data-testid="proof-mode-photo"
            className={`flex items-center justify-center gap-2 border py-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              mode === "photo" ? "border-[#ff7a2f] bg-[#ff7a2f]/10 text-[#ff7a2f]" : "border-white/10 text-white/50 hover:bg-white/5"
            }`}
          >
            <Camera size={15} /> Photo
          </button>
          <button
            onClick={() => { setMode("signature"); setProof(null); setProofType("signature"); }}
            data-testid="proof-mode-signature"
            className={`flex items-center justify-center gap-2 border py-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              mode === "signature" ? "border-[#ff7a2f] bg-[#ff7a2f]/10 text-[#ff7a2f]" : "border-white/10 text-white/50 hover:bg-white/5"
            }`}
          >
            <Signature size={15} /> Signature
          </button>
        </div>

        <div className="min-h-[210px]">
          {mode === "photo" ? (
            proof ? (
              <div className="relative">
                <img src={proof} alt="proof" className="max-h-52 w-full border border-white/10 object-contain" />
                <button
                  onClick={() => setProof(null)}
                  className="absolute right-2 top-2 flex items-center gap-1 border border-white/20 bg-black/60 px-2 py-1 font-mono text-[10px] text-white hover:text-red-400"
                >
                  <Trash size={12} /> Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                data-testid="proof-upload-btn"
                className="flex h-52 w-full flex-col items-center justify-center gap-2 border border-dashed border-white/15 text-white/40 transition-colors hover:border-[#ff7a2f]/50 hover:text-[#ff7a2f]"
              >
                <UploadSimple size={26} />
                <span className="text-xs">Tap to upload a delivery photo</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onFile}
                  className="hidden"
                  data-testid="proof-file-input"
                />
              </button>
            )
          ) : (
            <SignaturePad onChange={setProof} />
          )}
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)…"
          data-testid="proof-note-input"
          className="w-full border border-white/10 bg-[#0f1216] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#ff7a2f]"
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={() => { reset(); onOpenChange(false); }}
            className="border border-white/10 px-4 py-2.5 text-xs text-white/70 transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={submitting}
            data-testid="proof-confirm-btn"
            className="flex items-center justify-center gap-1.5 bg-emerald-500 px-4 py-2.5 font-head text-xs font-bold tracking-wide text-[#0f1216] transition-colors hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? <CircleNotch size={14} className="animate-spin" /> : <CheckCircle size={14} weight="bold" />}
            {proof ? "CONFIRM DELIVERY" : "MARK DELIVERED"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

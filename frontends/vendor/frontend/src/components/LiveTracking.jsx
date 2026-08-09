import { useEffect, useRef, useState } from "react";
import { getTracking } from "@/lib/api";
import { Truck, Store, MapPin, Phone, Clock, Navigation, Loader2 } from "lucide-react";

// Schematic map of the Consmat operating region — no external tiles.
const BOUNDS = { latMin: 17.18, latMax: 17.7, lngMin: 77.98, lngMax: 78.98 };
const W = 320, H = 190, PAD = 26;
const toXY = (lat, lng) => {
  const x = PAD + ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * (W - 2 * PAD);
  const y = PAD + (1 - (lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin)) * (H - 2 * PAD);
  return [x, y];
};

function etaText(iso) {
  if (!iso) return null;
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (isNaN(mins)) return null;
  if (mins <= 0) return "any moment now";
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `~${h}h${m ? ` ${m}m` : ""}`;
}

export function LiveTracking({ orderId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await getTracking(orderId);
        if (!alive) return;
        if (d?.error) { setErr(true); return; }
        setData(d);
        setErr(false);
        if (d.status === "dispatched") timer.current = setTimeout(tick, 4000);
      } catch {
        if (alive) setErr(true);
      }
    };
    tick();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [orderId]);

  if (err) return <p className="py-3 text-center text-sm text-[#94a3b8]">Live tracking is unavailable for this order.</p>;
  if (!data) return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#94a3b8]">
      <Loader2 size={16} className="animate-spin text-[#ff7a2f]" /> Locating the delivery…
    </div>
  );

  const [ox, oy] = toXY(data.origin.lat, data.origin.lng);
  const [dx, dy] = toXY(data.dest.lat, data.dest.lng);
  const [vx, vy] = toXY(data.vehicle.lat, data.vehicle.lng);
  const samePoint = Math.hypot(dx - ox, dy - oy) < 6;
  const pct = Math.round((data.progress || 0) * 100);
  const eta = etaText(data.eta_at);
  const delivered = data.status === "delivered";

  return (
    <div className="space-y-3" data-testid="live-tracking">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[#ff7a2f]">
          <Navigation size={14} /> {data.stage}
        </span>
        {data.status === "dispatched" && <span className="text-[11px] text-[#94a3b8]">live</span>}
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0f1216]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Delivery map">
          <defs>
            <pattern id="vgrid" width="26" height="26" patternUnits="userSpaceOnUse">
              <path d="M 26 0 L 0 0 0 26" fill="none" stroke="#ffffff10" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#vgrid)" />
          {!samePoint && <line x1={ox} y1={oy} x2={dx} y2={dy} stroke="#ff7a2f55" strokeWidth="2" strokeDasharray="4 4" />}
          {!samePoint && <line x1={ox} y1={oy} x2={vx} y2={vy} stroke="#ff7a2f" strokeWidth="2.5" />}
          <circle cx={ox} cy={oy} r="6" fill="#171c22" stroke="#ff7a2f" strokeWidth="2" />
          <text x={ox} y={oy - 10} fill="#ffffffcc" fontSize="8" textAnchor="middle">{data.origin.name}</text>
          <circle cx={dx} cy={dy} r="6" fill="#171c22" stroke="#22c55e" strokeWidth="2" />
          <text x={dx} y={dy + 16} fill="#ffffffcc" fontSize="8" textAnchor="middle">{data.dest.name}</text>
          {!delivered && (
            <g transform={`translate(${vx}, ${vy})`} style={{ transition: "all 0.8s ease" }}>
              <circle r="9" fill="#ff7a2f" />
              <circle r="13" fill="none" stroke="#ff7a2f55" strokeWidth="2" />
            </g>
          )}
        </svg>
      </div>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#ff7a2f] transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-[#94a3b8]">
          <span className="flex items-center gap-1"><Store size={11} /> {data.origin.name}</span>
          <span className="flex items-center gap-1"><MapPin size={11} className="text-[#22c55e]" /> {data.dest.name}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-[#94a3b8]">
          <span>
            {data.distance_km > 0
              ? delivered ? `Delivered · ${data.distance_km} km` : `${data.remaining_km} km to go of ${data.distance_km} km`
              : "Delivering within the area"}
          </span>
          {!delivered && eta && <span className="flex items-center gap-1 text-[#ff7a2f]"><Clock size={12} /> {eta}</span>}
        </div>
      </div>

      {data.driver && (
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0f1216] p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff7a2f]/15 text-[#ff7a2f]">
              <Truck size={17} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">{data.driver.name}</p>
              <p className="font-mono text-[11px] text-[#94a3b8]">{data.driver.vehicle_no}</p>
            </div>
          </div>
          <a
            href={`tel:${data.driver.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#94a3b8] transition-colors hover:border-[#ff7a2f]/40 hover:text-[#ff7a2f]"
          >
            <Phone size={13} /> Call
          </a>
        </div>
      )}
      <p className="text-center text-[10px] text-white/25">Simulated live tracking for this demo environment.</p>
    </div>
  );
}

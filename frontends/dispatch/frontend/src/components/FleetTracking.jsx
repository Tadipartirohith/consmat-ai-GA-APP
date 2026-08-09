import { useEffect, useRef, useState } from "react";
import { Truck, MapPin, Storefront, NavigationArrow, CircleNotch, Path } from "@phosphor-icons/react";
import { api } from "@/lib/api";

// Schematic map of the Consmat operating region — no external tiles.
const BOUNDS = { latMin: 17.18, latMax: 17.7, lngMin: 77.98, lngMax: 78.98 };
const W = 640, H = 300, PAD = 34;
const toXY = (lat, lng) => {
  const x = PAD + ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * (W - 2 * PAD);
  const y = PAD + (1 - (lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin)) * (H - 2 * PAD);
  return [x, y];
};

export default function FleetTracking() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await api.activeTracking();
        if (!alive) return;
        setData(d);
        setError(false);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) timer.current = setTimeout(tick, 5000);
      }
    };
    tick();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const deliveries = data?.deliveries || [];

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-head text-2xl font-extrabold tracking-tight text-white">Live Fleet</h1>
          <p className="text-xs text-white/45">
            Every in-transit delivery, updating live
          </p>
        </div>
        <span className="flex items-center gap-1.5 border border-[#10b981]/40 bg-[#10b981]/10 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-wider text-[#10b981]">
          <NavigationArrow size={13} weight="fill" /> {deliveries.length} ON THE ROAD
        </span>
      </div>

      {error && !data ? (
        <div className="border border-red-500/30 bg-red-500/5 py-16 text-center text-sm text-white/60">
          Could not reach the tracking API.
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-white/50">
          <CircleNotch size={18} className="animate-spin text-[#ff7a2f]" /> Loading fleet…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden border border-white/10 bg-[#0f1216]">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Fleet map">
              <defs>
                <pattern id="fgrid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#ffffff10" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={W} height={H} fill="url(#fgrid)" />
              {deliveries.map((d) => {
                const [ox, oy] = toXY(d.origin.lat, d.origin.lng);
                const [dx, dy] = toXY(d.dest.lat, d.dest.lng);
                const [vx, vy] = toXY(d.vehicle.lat, d.vehicle.lng);
                const active = selected === d.order_id;
                return (
                  <g key={d.order_id} onClick={() => setSelected(d.order_id)} style={{ cursor: "pointer" }}>
                    <line x1={ox} y1={oy} x2={dx} y2={dy} stroke={active ? "#ff7a2f" : "#ffffff22"} strokeWidth="1.5" strokeDasharray="4 4" />
                    <circle cx={ox} cy={oy} r="4" fill="#171c22" stroke="#8b93a1" strokeWidth="1.5" />
                    <circle cx={dx} cy={dy} r="4" fill="#171c22" stroke="#22c55e" strokeWidth="1.5" />
                    <g transform={`translate(${vx}, ${vy})`} style={{ transition: "all 1s ease" }}>
                      <circle r={active ? 8 : 6} fill="#ff7a2f" />
                      {active && <circle r="12" fill="none" stroke="#ff7a2f66" strokeWidth="2" />}
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="space-y-2">
            {deliveries.length === 0 ? (
              <div className="border border-dashed border-white/10 bg-[#171c22] py-12 text-center text-sm text-white/40">
                No deliveries in transit right now.
              </div>
            ) : (
              deliveries.map((d) => (
                <button
                  key={d.order_id}
                  onClick={() => setSelected(d.order_id)}
                  className={`w-full border p-3 text-left transition-colors ${
                    selected === d.order_id
                      ? "border-[#ff7a2f] bg-[#ff7a2f]/10"
                      : "border-white/10 bg-[#171c22] hover:border-[#ff7a2f]/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-[#ff7a2f]">#{d.order_id}</span>
                    <span className="flex items-center gap-1 text-[11px] text-white/50">
                      <Truck size={12} /> {d.remaining_km} km left
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-white/60">
                    <Storefront size={11} className="text-white/40" /> {d.vendor}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-white/60">
                    <MapPin size={11} className="text-[#22c55e]" /> {d.dest.name}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#ff7a2f]" style={{ width: `${Math.round((d.progress || 0) * 100)}%` }} />
                  </div>
                  {d.driver && (
                    <p className="mt-1.5 font-mono text-[10px] text-white/40">
                      {d.driver.name} · {d.driver.vehicle_no}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

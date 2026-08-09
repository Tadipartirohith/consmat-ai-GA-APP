import React from "react";
import { Star } from "lucide-react";
import { toStars } from "@/lib/format";

export function StarRating({ value, size = 14, showNumber = true }) {
  const stars = toStars(value);
  const rounded = Math.round(stars * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1" data-testid="star-rating">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0;
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <Star size={size} className="absolute text-white/20" />
              <span
                className="absolute overflow-hidden"
                style={{ width: `${fill * 100}%`, height: size }}
              >
                <Star size={size} className="text-[#ff7a2f] fill-[#ff7a2f]" />
              </span>
            </span>
          );
        })}
      </span>
      {showNumber && (
        <span className="text-xs font-mono text-white/60">{stars.toFixed(1)}</span>
      )}
    </span>
  );
}

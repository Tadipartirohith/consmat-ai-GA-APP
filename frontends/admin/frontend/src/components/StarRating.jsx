import React from "react";
import { Star } from "lucide-react";

export function StarRating({ value = 0, size = 14, showValue = true, testId }) {
  const rounded = Math.round((Number(value) || 0) * 2) / 2;
  return (
    <div className="flex items-center gap-1.5" data-testid={testId}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <span key={i} className="relative inline-flex" style={{ width: size, height: size }}>
              <Star size={size} className="text-cm-border absolute" fill="currentColor" strokeWidth={0} />
              {(filled || half) && (
                <span className="absolute overflow-hidden" style={{ width: half ? size / 2 : size, height: size }}>
                  <Star size={size} className="text-cm-accent" fill="currentColor" strokeWidth={0} />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {showValue && <span className="text-xs font-mono text-cm-muted">{(Number(value) || 0).toFixed(1)}</span>}
    </div>
  );
}

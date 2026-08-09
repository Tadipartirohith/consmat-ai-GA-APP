import { Star } from "@phosphor-icons/react";

export const StarRating = ({ value = 0, size = 12, testId }) => {
  const full = Math.floor(value);
  const hasHalf = value - full >= 0.5;
  return (
    <span
      className="inline-flex items-center gap-1"
      data-testid={testId}
      title={`${value} / 5`}
    >
      <span className="inline-flex items-center">
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = i < full || (i === full && hasHalf);
          return (
            <Star
              key={i}
              size={size}
              weight={filled ? "fill" : "regular"}
              className={filled ? "text-[#ff7a2f]" : "text-white/25"}
            />
          );
        })}
      </span>
      <span className="font-mono text-[11px] text-white/60">
        {Number(value).toFixed(1)}
      </span>
    </span>
  );
};

export default StarRating;

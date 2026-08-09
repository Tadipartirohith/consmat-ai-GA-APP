import { Star, StarHalf } from "lucide-react";

export const StarRating = ({ value = 0, size = 16, showValue = true, className = "" }) => {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const roundedUp = rating - full >= 0.75;
  const effectiveFull = roundedUp ? full + 1 : full;

  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < effectiveFull) {
      stars.push(
        <Star key={i} size={size} className="text-[#ff7a2f]" fill="#ff7a2f" strokeWidth={1.5} />
      );
    } else if (i === effectiveFull && hasHalf) {
      stars.push(
        <StarHalf key={i} size={size} className="text-[#ff7a2f]" fill="#ff7a2f" strokeWidth={1.5} />
      );
    } else {
      stars.push(
        <Star key={i} size={size} className="text-white/20" strokeWidth={1.5} />
      );
    }
  }

  return (
    <div className={`flex items-center gap-1 ${className}`} data-testid="star-rating">
      <div className="flex items-center gap-0.5">{stars}</div>
      {showValue && (
        <span className="ml-1 text-sm font-medium text-[#ff7a2f]" data-testid="star-rating-value">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default StarRating;

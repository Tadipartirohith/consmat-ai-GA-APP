const MAP = {
  pending: { label: "PENDING", color: "#f59e0b" },
  dispatched: { label: "DISPATCHED", color: "#3b82f6" },
  delivered: { label: "DELIVERED", color: "#10b981" },
};

export const StatusBadge = ({ status, testId }) => {
  const s = MAP[status] || { label: String(status).toUpperCase(), color: "#a1a1aa" };
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider px-2 py-1 border"
      style={{ color: s.color, borderColor: `${s.color}55`, backgroundColor: `${s.color}12` }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "pending" ? "animate-pulse-dot" : ""}`}
        style={{ backgroundColor: s.color }}
      />
      {s.label}
    </span>
  );
};

export default StatusBadge;

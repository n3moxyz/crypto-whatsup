interface RefreshPricesButtonProps {
  onClick: () => void;
  isLoading: boolean;
  secondsUntilRefresh?: number;
}

const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function RefreshPricesButton({ onClick, isLoading, secondsUntilRefresh }: RefreshPricesButtonProps) {
  const progress = secondsUntilRefresh != null ? secondsUntilRefresh / 60 : 1;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex items-center gap-2">
      {/* Separated countdown */}
      {!isLoading && secondsUntilRefresh != null && (
        <span className="text-muted font-mono" style={{ fontSize: "var(--text-xs)" }}>
          {secondsUntilRefresh}s
        </span>
      )}

      <button
        onClick={onClick}
        disabled={isLoading}
        className="btn btn-secondary flex items-center gap-1.5"
        style={{ fontSize: "var(--text-sm)", padding: "6px 12px" }}
        aria-label={isLoading ? "Refreshing prices" : "Refresh prices"}
      >
        {/* Refresh icon with circular progress ring */}
        <span className="relative inline-flex items-center justify-center" style={{ width: 20, height: 20 }}>
          {/* Progress ring background */}
          {!isLoading && secondsUntilRefresh != null && (
            <svg
              className="absolute inset-0"
              width={20}
              height={20}
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <circle
                cx="10"
                cy="10"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--border-color)"
                strokeWidth="1.5"
              />
              <circle
                cx="10"
                cy="10"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="progress-ring-circle"
              />
            </svg>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
            style={{ position: "relative", zIndex: 1 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </span>
        {isLoading ? "Refreshing\u2026" : "Refresh"}
      </button>
    </div>
  );
}

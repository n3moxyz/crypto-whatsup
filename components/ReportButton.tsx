interface ReportButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

export default function ReportButton({ onClick, isLoading }: ReportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        relative px-8 py-4 text-lg font-semibold rounded-xl
        transition-all duration-300 transform
        ${
          isLoading
            ? "bg-purple-600/50 cursor-not-allowed"
            : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
        }
        text-white
      `}
    >
      {isLoading ? (
        <span className="flex items-center gap-3">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Generating Report...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Generate Report
        </span>
      )}
    </button>
  );
}

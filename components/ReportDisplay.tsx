"use client";

import { useState, useEffect, useRef } from "react";

interface ReportDisplayProps {
  report: string;
  isLoading: boolean;
}

const ESTIMATED_TIME = 45; // Estimated seconds for report generation

export default function ReportDisplay({ report, isLoading }: ReportDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(ESTIMATED_TIME);
  const startTimeRef = useRef<number | null>(null);

  // Countdown timer — resets when isLoading changes
  useEffect(() => {
    if (!isLoading) {
      startTimeRef.current = null;
      return;
    }

    startTimeRef.current = Date.now();
    setTimeRemaining(ESTIMATED_TIME);

    const interval = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTimeRemaining(Math.max(0, ESTIMATED_TIME - elapsed));
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const progress = ((ESTIMATED_TIME - timeRemaining) / ESTIMATED_TIME) * 100;

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex flex-col items-center justify-center py-8">
          {/* Circular progress indicator */}
          <div className="relative mb-4">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="var(--border-color)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="var(--accent)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-primary font-mono font-semibold" style={{ fontSize: "var(--text-lg)" }}>
                {timeRemaining > 0 ? formatTime(timeRemaining) : "…"}
              </span>
            </div>
          </div>
          <p className="text-secondary mb-1" style={{ fontSize: "var(--text-sm)" }}>
            Generating weekly update…
          </p>
          <p className="text-muted" style={{ fontSize: "var(--text-xs)" }}>
            {timeRemaining > 0 ? "Estimated time remaining" : "Almost done, finalizing…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
          Weekly Update
        </span>
        <button
          onClick={copyToClipboard}
          className="btn-ghost"
          style={{ fontSize: "var(--text-xs)" }}
        >
          {copied ? (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <div className="data-cell">
        <pre
          className="whitespace-pre-wrap text-primary"
          style={{ fontSize: "var(--text-sm)", fontFamily: "inherit", lineHeight: 1.6 }}
        >
          {report}
        </pre>
      </div>
    </div>
  );
}

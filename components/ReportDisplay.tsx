"use client";

import { useState } from "react";

interface ReportDisplayProps {
  report: string;
  isLoading: boolean;
}

export default function ReportDisplay({ report, isLoading }: ReportDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
          </div>
          <p className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
            Generating report...
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
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

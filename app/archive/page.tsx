"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ArchiveEntry {
  date: string;
  dateLabel: string;
  content: string;
  images: string[];
}

function formatContent(text: string): string {
  // Replace *text* with <strong>text</strong> (Telegram bold markdown)
  return text.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");
}

export default function ArchivePage() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function fetchArchive() {
      try {
        const res = await fetch("/api/archive");
        if (!res.ok) throw new Error("Failed to fetch archive");
        const data = await res.json();
        setEntries(data.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load archive");
      } finally {
        setIsLoading(false);
      }
    }
    fetchArchive();
  }, []);

  return (
    <div className="bg-primary" style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "24px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <Link
            href="/"
            className="btn-ghost"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "var(--text-sm)",
              textDecoration: "none",
              marginBottom: "16px",
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            &larr; Back
          </Link>
          <h1
            className="text-primary"
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Market Update Archive
          </h1>
          <p
            className="text-muted"
            style={{
              fontSize: "var(--text-sm)",
              marginTop: "4px",
            }}
          >
            Historical market updates and charts
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div
            className="card"
            style={{
              padding: "40px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              <div className="loading-dot" />
              <div className="loading-dot" />
              <div className="loading-dot" />
            </div>
            <p className="text-muted" style={{ fontSize: "var(--text-sm)", margin: 0 }}>
              Loading archive...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            className="card"
            style={{
              padding: "20px",
              textAlign: "center",
              borderColor: "var(--danger)",
            }}
          >
            <p style={{ color: "var(--danger)", margin: 0, fontSize: "var(--text-sm)" }}>
              {error}
            </p>
          </div>
        )}

        {/* Entries */}
        {!isLoading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {entries.map((entry) => (
              <article key={entry.date} className="card" style={{ padding: "24px" }}>
                {/* Date header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "16px",
                    paddingBottom: "12px",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "var(--accent)",
                      flexShrink: 0,
                    }}
                  />
                  <h2
                    className="text-primary"
                    style={{
                      fontSize: "var(--text-lg)",
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {entry.dateLabel}
                  </h2>
                </div>

                {/* Text content */}
                <div
                  className="text-secondary"
                  style={{
                    fontSize: "var(--text-base)",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: formatContent(entry.content),
                  }}
                />

                {/* Images */}
                {entry.images.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "12px",
                      marginTop: "16px",
                    }}
                  >
                    {entry.images.map((img) => (
                      <img
                        key={img}
                        src={`/api/archive/images/${img}`}
                        alt={`Chart for ${entry.dateLabel}`}
                        style={{
                          maxWidth: "100%",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-color)",
                        }}
                      />
                    ))}
                  </div>
                )}
              </article>
            ))}

            {entries.length === 0 && (
              <div
                className="card"
                style={{
                  padding: "40px",
                  textAlign: "center",
                }}
              >
                <p className="text-muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                  No archive entries found.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

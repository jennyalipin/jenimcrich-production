"use client";

/**
 * Last-resort boundary for failures in the root layout itself. It replaces the
 * entire document, so it can't rely on the shared layout, fonts, or globals.css
 * — everything is inlined. Kept minimal, branded, and human-readable.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(120% 80% at 50% 30%, #13324a 0%, #0f172a 55%, #0b1220 100%)",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#f8fafc",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <svg
            width={56}
            height={56}
            viewBox="172 172 680 680"
            role="img"
            aria-label="Jenny Mcrich"
            style={{ marginBottom: 20 }}
          >
            <path
              fill="#ffffff"
              d="M520.38,811.63l.34-155.66c.07-32.3,30.7-63.53,64.85-65.78-34.91-2.99-63.1-30.96-65.18-66.53l-.02-154.86h142.23s-.02,304.71-.02,304.71c-.66,37.1-15.45,71.03-41.98,96.46-26.1,26.92-61.27,42.04-100.22,41.65Z"
            />
            <circle fill="#ffffff" cx="591.49" cy="282.72" r="71.07" />
            <path
              fill="#10b981"
              d="M504.07,657.21l.23,154.41c-38.13.5-73.87-14.38-100.26-41.65-26.4-25.44-41.79-59.33-41.85-96.33l-.13-82.48,82.81.39c14.86.07,27.25,9.37,37.98,18.57,12.22,12.78,21.19,28.12,21.22,47.1Z"
            />
            <circle fill="#10b981" cx="433.18" cy="509.04" r="71.06" />
          </svg>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            The app hit an unexpected error
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "#cbd5e1",
              margin: "0 0 20px",
            }}
          >
            Something went wrong while loading. Reloading usually fixes it. If it
            keeps happening, let us know.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: 6,
              padding: "10px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              color: "#ffffff",
              background: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            Reload the app
          </button>
          {error.digest ? (
            <p style={{ marginTop: 16, fontSize: 11.5, color: "#64748b" }}>
              Reference code: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

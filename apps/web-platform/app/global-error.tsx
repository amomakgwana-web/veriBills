"use client";

// Next.js's own catch-all for an error thrown anywhere below the root
// layout (including layout.tsx/providers.tsx themselves) is a bare
// "Application error: a client-side exception has occurred" with zero
// detail — exactly what showed up in production with no way to tell what
// actually threw. global-error.tsx replaces that default with something
// that shows the real error, since asking someone to read their own
// DevTools console has been the actual bottleneck diagnosing failures in
// this app more than once. It must render its own <html>/<body> — this
// fully replaces the root layout when the root layout itself is what
// errored.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#080808", color: "#F0F0F0", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 640, margin: "80px auto" }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>veriBills hit an unexpected error</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", marginBottom: 16 }}>
            This is a bug, not a wrong password or a missing account — the details below are what actually failed.
          </div>
          <pre
            style={{
              background: "#141414",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 8,
              padding: 14,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              marginBottom: 16,
            }}
          >
            {`name: ${error.name}\nmessage: ${error.message}${error.digest ? `\ndigest: ${error.digest}` : ""}${error.stack ? `\n\nstack:\n${error.stack}` : ""}`}
          </pre>
          <button
            onClick={() => reset()}
            style={{
              background: "#F05A00",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

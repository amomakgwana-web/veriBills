import { NextResponse } from "next/server";

/**
 * Stand-in for the issuer's 3-D Secure challenge page.
 *
 * A real gateway redirects the cardholder to their bank, which posts the result
 * back to our return URL. The mock renders the same shape so the full
 * challenge -> return -> capture path is exercised in development.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? "";
  const returnUrl = url.searchParams.get("return") ?? "/tenant/billing";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Verify your payment</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #f1f5f9; margin: 0;
           display: grid; place-items: center; min-height: 100vh; padding: 1rem; }
    .card { background: #fff; border-radius: 12px; padding: 28px; max-width: 380px; width: 100%;
            box-shadow: 0 10px 30px rgba(15,23,42,.12); }
    h1 { font-size: 17px; margin: 0 0 6px; color: #0f172a; }
    p { font-size: 14px; color: #475569; line-height: 1.55; margin: 0 0 18px; }
    .bank { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-bottom: 14px; }
    button { width: 100%; padding: 11px; border-radius: 8px; font-size: 14px; font-weight: 600;
             border: 0; cursor: pointer; margin-bottom: 8px; }
    .approve { background: #0f766e; color: #fff; }
    .decline { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
    code { font-size: 11px; color: #94a3b8; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="bank">Secure verification · Simulated issuer</div>
    <h1>Approve this payment?</h1>
    <p>Your bank would normally ask for a one-time PIN or in-app approval here.
       This is the veriBills development stand-in.</p>
    <form method="POST" action="/api/payments/3ds/return">
      <input type="hidden" name="ref" value="${escapeAttribute(ref)}">
      <input type="hidden" name="return" value="${escapeAttribute(returnUrl)}">
      <button class="approve" name="outcome" value="approved" type="submit">Approve payment</button>
      <button class="decline" name="outcome" value="failed" type="submit">Decline</button>
      <button class="decline" name="outcome" value="abandoned" type="submit">Cancel</button>
    </form>
    <code>${escapeAttribute(ref)}</code>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

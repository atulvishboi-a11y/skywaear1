import { readAdminSession } from "@/lib/server/auth";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    const isAdmin = await readAdminSession();
    if (!isAdmin) {
      return new Response("Forbidden: Simulation checkout is disabled in production mode.", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || `op_sim_${Date.now()}`;
  const ref = searchParams.get("ref") || "OP-TEST";
  const amount = searchParams.get("amount") || "999";
  const redirect = searchParams.get("redirect") || "/";

  const successRedirect = `${redirect}&ownpay_payment_id=${encodeURIComponent(id)}&ownpay_ref=${encodeURIComponent(ref)}&status=completed`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OwnPay | Secure Checkout</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0B0C10;
      color: #F5F5F7;
      font-family: 'Space Grotesk', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #16181D;
      border: 1px solid #282C34;
      max-width: 480px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.4);
      color: #00F0FF;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: bold;
      padding: 4px 10px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    p.sub {
      font-size: 13px;
      color: #8E929B;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .details {
      background: #0B0C10;
      border: 1px solid #282C34;
      padding: 18px;
      margin-bottom: 24px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      color: #8E929B;
    }
    .row.total {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px dashed #282C34;
      font-size: 15px;
      font-weight: bold;
      color: #00FF66;
    }
    .val { color: #FFFFFF; font-weight: bold; }
    .btn-pay {
      display: block;
      width: 100%;
      background: #00FF66;
      color: #0B0C10;
      border: none;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 14px;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-pay:hover {
      background: #00dd55;
      transform: translateY(-1px);
    }
    .btn-cancel {
      display: block;
      width: 100%;
      background: transparent;
      color: #8E929B;
      border: 1px solid #282C34;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      padding: 10px;
      text-align: center;
      text-decoration: none;
      margin-top: 12px;
      cursor: pointer;
      transition: color 150ms ease-out, border-color 150ms ease-out;
    }
    .btn-cancel:hover { color: #fff; border-color: #fff; }
    .note {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #666;
      margin-top: 20px;
      text-align: center;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">⚡ OwnPay Orchestration Gateway</div>
    <h1>Direct Gateway Payment</h1>
    <p class="sub">Self-hosted sovereign payment checkout powered by OwnPay.</p>

    <div class="details">
      <div class="row">
        <span>Payment ID:</span>
        <span class="val">${id}</span>
      </div>
      <div class="row">
        <span>Order Ref:</span>
        <span class="val">${ref}</span>
      </div>
      <div class="row">
        <span>Currency:</span>
        <span class="val">INR (₹)</span>
      </div>
      <div class="row total">
        <span>Total Payable:</span>
        <span>₹${amount}</span>
      </div>
    </div>

    <a href="${successRedirect}" class="btn-pay">Authorize & Pay ₹${amount}</a>
    <a href="/?checkout=cancelled" class="btn-cancel">Cancel and Return</a>

    <div class="note">
      When your live OwnPay VPS instance URL & API Key are added in .env, this screen is handled directly by your self-hosted instance.
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

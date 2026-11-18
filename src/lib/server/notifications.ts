import type { CustomerAccount } from "@/data/rewardsEngine";
import type { CashbackTranche, ShopOrder, ZeninNotification } from "@/lib/domain";
import type { ZeninState } from "./store";
import { broadcastPushNotification } from "./webpush";
import { sendWhatsAppMessage } from "./otpService";

function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export interface BuildUnlockNotificationInput {
  customer: CustomerAccount;
  order: ShopOrder;
  slice: CashbackTranche;
  liveWalletCoins: number;
  storeUrl?: string;
}

export function buildCashbackUnlockNotification({
  customer,
  order,
  slice,
  liveWalletCoins,
  storeUrl = "http://localhost:3000",
}: BuildUnlockNotificationInput): {
  id: string;
  title: string;
  message: string;
  whatsappText: string;
  whatsappUrl: string;
  smsContent: string;
  emailContent: {
    subject: string;
    text: string;
    html: string;
  };
} {
  const notifId = `notif-cb-${order.orderNumber}-d${slice.week}`;
  const phoneDigits = normalizePhoneDigits(customer.phone);
  const liveCoins = liveWalletCoins.toLocaleString("en-IN");
  const unlockCoins = slice.coins.toLocaleString("en-IN");
  const walletLink = `${storeUrl}/?tab=wallet`;

  const title = `🎉 Day ${slice.week}/30 Cashback Unlocked: ${unlockCoins} Coins`;
  const message = `${unlockCoins} Coins on Order #${order.orderNumber} has unlocked and transferred into your Live Wallet.`;

  // WhatsApp formatted template
  const whatsappText = [
    `🔥 *SKYWARE CASHBACK UNLOCKED* (Day ${slice.week}/30)`,
    ``,
    `Hey ${customer.name.split(" ")[0]}! Your daily cashback tranche has just unlocked and landed in your Live Wallet:`,
    `💰 *Unlocked Now:* ${unlockCoins} Coins`,
    `📦 *Order:* #${order.orderNumber}`,
    `💼 *Total Live Wallet Balance:* ${liveCoins} Coins`,
    ``,
    `Withdraw to your UPI/Bank anytime:`,
    `${walletLink}`,
  ].join("\n");

  const whatsappUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(whatsappText)}`;

  // Transactional SMS (under 160 characters for standard GSM SMS DLT gateway)
  const smsContent = `SKYWARE: Day ${slice.week}/30 cashback of ${slice.coins} coins on order #${order.orderNumber} is unlocked & credited to your Live Wallet. Login to withdraw: ${walletLink}`;

  // Rich HTML Email
  const emailSubject = `🎉 ${unlockCoins} Coins Cashback Unlocked! (Day ${slice.week}/30 on #${order.orderNumber})`;

  const emailText = [
    `SKYWARE STREETWEAR — CASHBACK UNLOCKED`,
    `----------------------------------------------------`,
    `Hi ${customer.name},`,
    ``,
    `Great news! Day ${slice.week} of your 30-day daily cashback schedule on Order #${order.orderNumber} has just unlocked.`,
    ``,
    `Unlocked Cashback: ${unlockCoins} Coins`,
    `Current Live Wallet Balance: ${liveCoins} Coins`,
    ``,
    `Your coins are ready in your Live Wallet. You can request a payout to your UPI ID or bank account any time.`,
    ``,
    `View your wallet & withdraw: ${walletLink}`,
    `----------------------------------------------------`,
    `© Skywear Streetwear. All rights reserved.`,
  ].join("\n");

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0c0c; color: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #171717; border: 1px solid #2e2e2e; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1f1f1f 0%, #000000 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid #333; }
    .logo { font-size: 26px; font-weight: 900; letter-spacing: 0.18em; color: #ffffff; text-transform: uppercase; margin: 0; }
    .badge { display: inline-block; background-color: #f59e0b; color: #000000; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; margin-top: 12px; }
    .content { padding: 32px 24px; }
    .title { font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    .p-text { font-size: 14px; line-height: 1.6; color: #a3a3a3; margin-bottom: 24px; }
    .amount-card { background: #262626; border: 1px solid #404040; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 28px; }
    .amount-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #a3a3a3; margin-bottom: 6px; }
    .amount-value { font-size: 36px; font-weight: 900; color: #10b981; margin: 0; font-family: monospace; }
    .amount-sub { font-size: 13px; color: #737373; margin-top: 6px; }
    .details-row { display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding: 10px 0; font-size: 13px; }
    .details-row:last-child { border-bottom: none; }
    .details-label { color: #888; }
    .details-val { font-weight: 700; color: #eee; font-family: monospace; }
    .btn-container { text-align: center; margin-top: 32px; margin-bottom: 20px; }
    .btn { display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; font-weight: 800; font-size: 14px; padding: 14px 28px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .footer { background-color: #121212; padding: 20px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #262626; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">SKYWARE</div>
      <div class="badge">Day ${slice.week} of 30 Unlocked</div>
    </div>
    <div class="content">
      <h2 class="title">Cashback Landed in Your Live Wallet! 💸</h2>
      <p class="p-text">
        Hey ${customer.name}, your daily cashback tranche from Order <strong>#${order.orderNumber}</strong> has unlocked automatically and is now live.
      </p>

      <div class="amount-card">
        <div class="amount-label">Unlocked Today</div>
        <div class="amount-value">+${unlockCoins}</div>
        <div class="amount-sub">Reward Coins Added</div>
      </div>

      <div style="background-color: #1c1c1c; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
        <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px;">
          <tr>
            <td style="color: #888;">Order Number:</td>
            <td align="right" style="color: #fff; font-family: monospace; font-weight: bold;">#${order.orderNumber}</td>
          </tr>
          <tr>
            <td style="color: #888;">Schedule:</td>
            <td align="right" style="color: #fff;">Day ${slice.week} of 30</td>
          </tr>
          <tr>
            <td style="color: #888;">Live Wallet Total:</td>
            <td align="right" style="color: #10b981; font-family: monospace; font-weight: bold;">${liveCoins} Coins</td>
          </tr>
        </table>
      </div>

      <div class="btn-container">
        <a href="${walletLink}" class="btn">Open My Wallet</a>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from Skywear Streetwear. You received this because you earned cashback on purchase #${order.orderNumber}.
    </div>
  </div>
</body>
</html>
  `.trim();

  return {
    id: notifId,
    title,
    message,
    whatsappText,
    whatsappUrl,
    smsContent,
    emailContent: {
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    },
  };
}

export function dispatchCashbackUnlockNotification(
  state: ZeninState,
  customer: CustomerAccount,
  order: ShopOrder,
  slice: CashbackTranche,
  storeUrl?: string
): ZeninNotification | null {
  if (!state.notifications) {
    state.notifications = [];
  }

  const notifId = `notif-cb-${order.orderNumber}-w${slice.week}`;

  // Idempotency: avoid duplicate notification for same slice
  const existing = state.notifications.find((n) => n.id === notifId);
  if (existing) {
    return existing;
  }

  const built = buildCashbackUnlockNotification({
    customer,
    order,
    slice,
    liveWalletCoins: customer.availableCoins,
    storeUrl,
  });

  const notification: ZeninNotification = {
    id: built.id,
    customerId: customer.id,
    type: "CASHBACK_UNLOCKED",
    title: built.title,
    message: built.message,
    channels: ["IN_APP", "WHATSAPP", "SMS", "EMAIL", "WEB_PUSH"],
    channelStatus: {
      inApp: "DELIVERED",
      whatsapp: "PREPARED",
      sms: "PREPARED",
      email: "PREPARED",
    },
    whatsappUrl: built.whatsappUrl,
    smsContent: built.smsContent,
    emailContent: built.emailContent,
    createdAt: new Date().toISOString(),
    read: false,
    metadata: {
      orderNumber: order.orderNumber,
      week: slice.week,
      coins: slice.coins,
    },
  };

  state.notifications.unshift(notification);

  try {
    void broadcastPushNotification(
      {
        title: built.title,
        body: built.message,
        url: "/?tab=wallet",
        tag: built.id,
      },
      customer.id
    );
  } catch (err) {
    console.error("[webpush] Failed to send cashback unlock push:", err);
  }

  if (customer.phone) {
    void sendWhatsAppMessage(customer.phone, built.whatsappText).then((sent) => {
      if (sent) notification.channelStatus.whatsapp = "SENT";
    });
  }

  // Simulated multi-channel dispatch logging
  console.log(
    `[Notification Dispatch] 🔔 Customer: ${customer.name} (${customer.email} | ${customer.phone})`
  );
  console.log(`  ✉️ Email sent: "${built.emailContent.subject}"`);
  console.log(`  💬 WhatsApp message prepared: ${built.whatsappText.slice(0, 60)}...`);
  console.log(`  📱 SMS sent: "${built.smsContent.slice(0, 60)}..."`);
  console.log(`  🔔 In-App notification delivered: ${built.id}`);
  console.log(`  ⚡ Web Push notification queued: ${built.title}`);

  return notification;
}

export function markNotificationAsRead(
  state: ZeninState,
  notificationId: string,
  customerId?: string
): ZeninNotification | null {
  if (!state.notifications) return null;
  const notif = state.notifications.find(
    (n) => n.id === notificationId && (!customerId || n.customerId === customerId)
  );
  if (notif) {
    notif.read = true;
    notif.channelStatus.inApp = "READ";
    return notif;
  }
  return null;
}

export function markAllNotificationsAsRead(
  state: ZeninState,
  customerId: string
): number {
  if (!state.notifications) return 0;
  let count = 0;
  state.notifications.forEach((n) => {
    if (n.customerId === customerId && !n.read) {
      n.read = true;
      n.channelStatus.inApp = "READ";
      count++;
    }
  });
  return count;
}

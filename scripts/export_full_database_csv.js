const fs = require('fs');
const path = require('path');

const backupPath = path.resolve('.data/backups/zenin-state-2026-11-05T15-57-39-924Z.json');
const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const outDir = path.resolve('exports/database_full_export');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    return '"' + JSON.stringify(val).replace(/"/g, '""') + '"';
  }
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function writeCsv(filename, headers, rows) {
  const content = [
    headers.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(','))
  ].join('\n');
  fs.writeFileSync(path.join(outDir, filename), content, 'utf8');
  console.log(`Exported ${filename} (${rows.length} rows)`);
}

// 1. Customers
const custHeaders = [
  'Customer ID',
  'Name',
  'Email',
  'Phone',
  'Tier',
  'UPI ID',
  'Referral Code',
  'Referred By',
  'Available Coins',
  'Pending Locked Coins',
  'Lifetime Earned Coins',
  'Last Daily Claim Date'
];
const custRows = (data.customers || []).map(c => [
  c.id,
  c.name,
  c.email,
  c.phone,
  c.tier,
  c.savedUpiId || '',
  c.referralCode || '',
  c.referredByCode || '',
  c.availablePoints ?? 0,
  c.pendingPoints ?? 0,
  c.lifetimeEarnedPoints ?? 0,
  c.lastDailyClaimDate || ''
]);
writeCsv('01_customers.csv', custHeaders, custRows);

// 2. Orders
const orderHeaders = [
  'Order ID',
  'Order Number',
  'Customer ID',
  'Customer Name',
  'Customer Phone',
  'Customer Email',
  'Placed At (UTC)',
  'Subtotal (INR)',
  'Discount (INR)',
  'Total Amount (INR)',
  'Payment Method',
  'Payment Status',
  'Order Status',
  'POD Status',
  'POD Provider',
  'Coins Earned',
  'Coins Redeemed',
  'Delivery Address',
  'City',
  'State',
  'Pincode',
  'Payment Reference / UTR'
];
const orderRows = (data.orders || []).map(o => [
  o.id,
  o.orderNumber,
  o.customerId,
  o.customerName,
  o.customerPhone,
  o.customerEmail,
  o.placedAt,
  o.subtotal || o.total,
  o.discount || 0,
  o.total,
  o.paymentMethod,
  o.paymentStatus,
  o.status,
  o.podStatus || '',
  o.podProvider || '',
  o.pointsEarned || 0,
  o.pointsRedeemed || 0,
  o.address || '',
  o.city || '',
  o.state || '',
  o.pincode || '',
  o.utr || o.gatewayOrderId || ''
]);
writeCsv('02_orders.csv', orderHeaders, orderRows);

// 3. Order Items (Itemized product level)
const itemHeaders = [
  'Order ID',
  'Order Number',
  'Customer Name',
  'Product Title',
  'Size',
  'Color',
  'Quantity',
  'Unit Price (INR)',
  'Item Subtotal (INR)'
];
const itemRows = [];
for (const o of data.orders || []) {
  for (const item of o.items || []) {
    itemRows.push([
      o.id,
      o.orderNumber,
      o.customerName,
      item.title || item.name || '',
      item.size || '',
      item.color || '',
      item.quantity || 1,
      item.price || 0,
      (item.quantity || 1) * (item.price || 0)
    ]);
  }
}
writeCsv('03_order_items.csv', itemHeaders, itemRows);

// 4. Withdrawals
const wthHeaders = [
  'Withdrawal ID',
  'Customer ID',
  'Customer Name',
  'Phone',
  'UPI ID',
  'Requested At (UTC)',
  'Coins / Points',
  'Rupee Value (INR)',
  'Payout Method',
  'Status',
  'Related Order Number',
  'Transaction / UTR Ref',
  'Rejection Reason'
];
const wthRows = (data.withdrawals || []).map(w => {
  const ref = w.transactionRefNumber || (w.tranches && w.tranches[0] && w.tranches[0].upiRef) || '';
  return [
    w.id,
    w.customerId,
    w.customerName,
    w.phone,
    w.upiId,
    w.requestedAt,
    w.totalPoints || w.points || 0,
    w.totalRupees || w.amountRupees || 0,
    w.payoutMethod || 'UPI',
    w.overallStatus,
    w.purchaseOrderNumber || '',
    ref,
    w.rejectionReason || ''
  ];
});
writeCsv('04_withdrawals.csv', wthHeaders, wthRows);

// 5. Wallet & Coin Transactions
const txHeaders = [
  'Transaction ID',
  'Customer ID',
  'Order ID',
  'Order Number',
  'Date / Timestamp',
  'Type',
  'Coins / Points',
  'Rupee Value (INR)',
  'Status',
  'Description'
];
const txRows = (data.transactions || []).map(t => [
  t.id,
  t.customerId,
  t.orderId || '',
  t.orderNumber || '',
  t.date,
  t.type,
  t.points ?? t.coins ?? 0,
  t.rupeeValue ?? t.legacyInrValue ?? 0,
  t.status,
  t.description || ''
]);
writeCsv('05_wallet_transactions.csv', txHeaders, txRows);

// 6. Products Catalog
const prodHeaders = [
  'Product ID',
  'SKU',
  'Slug',
  'Title',
  'Subtitle',
  'Price (INR)',
  'MRP (INR)',
  'Stock',
  'Category',
  'Sizes Available',
  'Colors Available',
  'Fabric / GSM',
  'Cashback Coins',
  'Rating',
  'Reviews Count',
  'Is Archived'
];
const prodRows = (data.products || []).map(p => [
  p.id,
  p.sku || '',
  p.slug || '',
  p.title,
  p.subtitle || '',
  p.price,
  p.mrp,
  p.stock,
  p.category || '',
  (p.sizes || []).join(' | '),
  (p.colors || []).join(' | '),
  `${p.fabric || ''} (${p.gsm || ''} GSM)`.trim(),
  p.cashbackPoints || p.rewardCoins || 0,
  p.rating || 0,
  p.reviewsCount || 0,
  p.isArchived ? 'Yes' : 'No'
]);
writeCsv('06_products.csv', prodHeaders, prodRows);

// 7. Referrals
const refHeaders = [
  'Referral ID',
  'Referrer ID',
  'Referrer Code',
  'Friend Name',
  'Friend Phone',
  'Friend Email',
  'Order Number',
  'Order Amount (INR)',
  'Commission Earned (INR)',
  'Status',
  'Date Joined'
];
const refRows = (data.referrals || []).map(r => [
  r.id,
  r.referrerId,
  r.referrerCode,
  r.friendName,
  r.friendPhone,
  r.friendEmail,
  r.orderNumber || '',
  r.orderAmount || 0,
  r.commissionEarned || 0,
  r.status,
  r.dateJoined || ''
]);
writeCsv('07_referrals.csv', refHeaders, refRows);

// 8. Audit Logs
const auditHeaders = [
  'Log ID',
  'Timestamp',
  'Actor',
  'Action',
  'Details'
];
const auditRows = (data.auditLogs || []).map(a => [
  a.id,
  a.at,
  a.actor,
  a.action,
  typeof a.details === 'object' ? JSON.stringify(a.details) : String(a.details || '')
]);
writeCsv('08_audit_logs.csv', auditHeaders, auditRows);

// 9. Notifications
const notifHeaders = [
  'Notification ID',
  'Customer ID',
  'Title',
  'Message',
  'Read Status',
  'Created At'
];
const notifRows = [];
for (const c of data.customers || []) {
  for (const n of c.notifications || []) {
    notifRows.push([
      n.id,
      c.id,
      n.title,
      n.message,
      n.read ? 'READ' : 'UNREAD',
      n.createdAt || ''
    ]);
  }
}
for (const n of data.notifications || []) {
  notifRows.push([
    n.id,
    n.customerId || 'ALL',
    n.title,
    n.message,
    n.read ? 'READ' : 'UNREAD',
    n.createdAt || ''
  ]);
}
writeCsv('09_notifications.csv', notifHeaders, notifRows);

// 10. Reviews
const reviewHeaders = [
  'Review ID',
  'Product ID',
  'Customer Name',
  'Rating',
  'Title',
  'Comment',
  'Created At',
  'Verified'
];
const reviewRows = (data.reviews || []).map(r => [
  r.id,
  r.productId,
  r.customerName || r.author,
  r.rating,
  r.title || '',
  r.comment || r.content || '',
  r.createdAt || '',
  r.verified ? 'Yes' : 'No'
]);
writeCsv('10_reviews.csv', reviewHeaders, reviewRows);

// 11. System Configurations
const configHeaders = ['Section', 'Parameter', 'Configured Value'];
const configRows = [];

function flattenObj(prefix, obj) {
  if (!obj) return;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      flattenObj(`${prefix} > ${k}`, v);
    } else {
      configRows.push([prefix, k, String(v)]);
    }
  }
}

flattenObj('Payment Gateways', data.gateways);
flattenObj('Manual UPI Settings', data.manualUpi);
flattenObj('Rewards & Cashback Engine Rules', data.rewardRules);
flattenObj('Qikink Print-On-Demand Settings', data.qikink);
flattenObj('Customer Support Settings', data.support);

writeCsv('11_system_configurations.csv', configHeaders, configRows);

console.log('--- ALL TABLES EXPORTED SUCCESSFULLY ---');


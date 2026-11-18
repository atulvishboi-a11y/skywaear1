const fs = require('fs');
const path = require('path');

const backupPath = path.resolve('.data/backups/zenin-state-2026-11-05T15-57-39-924Z.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const vikash = backup.customers.find(c => c.id === 'usr-mvxo22lh');
const orders = backup.orders.filter(o => o.customerId === 'usr-mvxo22lh');
const withdrawals = backup.withdrawals.filter(w => w.customerId === 'usr-mvxo22lh');
const txs = (backup.transactions || []).filter(t => t.customerId === 'usr-mvxo22lh');

const outDir = path.resolve('exports');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// 1. Consolidated Summary CSV
const summaryRows = [
  ['Category', 'Field', 'Value'],
  ['Customer Profile', 'Name', vikash.name],
  ['Customer Profile', 'Phone', vikash.phone],
  ['Customer Profile', 'Email', vikash.email],
  ['Customer Profile', 'Saved UPI ID', vikash.savedUpiId],
  ['Customer Profile', 'Customer ID', vikash.id],
  ['Customer Profile', 'Referral Code', vikash.referralCode],
  ['Customer Profile', 'Referred By', vikash.referredByCode || 'SKYWEAR-97JFZ'],
  ['Customer Profile', 'Tier', vikash.tier],
  ['Customer Profile', 'Lifetime Coins Earned', vikash.lifetimeEarnedPoints],
  ['Customer Profile', 'Available Coins in Wallet', vikash.availablePoints],
  ['Customer Profile', 'Pending Locked Coins', vikash.pendingPoints],
  ['', '', ''],
  ['Purchase History', 'Total Orders Placed', orders.length],
  ['Purchase History', 'Total Spent (INR)', orders.reduce((sum, o) => sum + (o.total || 0), 0)],
  ['Purchase History', 'Total T-Shirts Bought', orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + (i.quantity || 0), 0), 0)],
  ['', '', ''],
  ['Withdrawals History', 'Total Withdrawals Requested', withdrawals.length],
  ['Withdrawals History', 'Total Paid Coins', withdrawals.filter(w => w.overallStatus === 'PAID').reduce((sum, w) => sum + (w.totalPoints || w.points || 0), 0)],
  ['Withdrawals History', 'Total Paid Cash (INR)', withdrawals.filter(w => w.overallStatus === 'PAID').reduce((sum, w) => sum + (w.totalRupees || w.amountRupees || 0), 0)]
];
const summaryCsv = summaryRows.map(r => r.map(escapeCsv).join(',')).join('\n');
fs.writeFileSync(path.join(outDir, 'vikash_patel_profile_overview.csv'), summaryCsv, 'utf8');

// 2. Orders & Products CSV
const orderHeaders = [
  'Customer Name',
  'Phone',
  'Order Number',
  'Order Date (UTC)',
  'Order Date (IST)',
  'Product Name',
  'Size',
  'Color',
  'Quantity',
  'Item Price (INR)',
  'Order Total (INR)',
  'Payment Method',
  'Payment Status',
  'Cashback Coins Earned',
  'Delivery Address',
  'City',
  'State',
  'Pincode',
  'Payment UTR'
];
const orderRows = [];
for (const o of orders) {
  const istDate = new Date(o.placedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  for (const item of o.items) {
    orderRows.push([
      vikash.name,
      vikash.phone,
      o.orderNumber,
      o.placedAt,
      istDate,
      item.title,
      item.size,
      item.color,
      item.quantity,
      item.price,
      o.total,
      o.paymentMethod,
      o.paymentStatus,
      o.pointsEarned,
      o.address,
      o.city,
      o.state,
      o.pincode,
      o.utr || ''
    ]);
  }
}
const ordersCsv = [orderHeaders.map(escapeCsv).join(','), ...orderRows.map(r => r.map(escapeCsv).join(','))].join('\n');
fs.writeFileSync(path.join(outDir, 'vikash_patel_orders.csv'), ordersCsv, 'utf8');

// 3. Withdrawals CSV
const withdrawalHeaders = [
  'Customer Name',
  'Phone',
  'Withdrawal ID',
  'Requested Date (UTC)',
  'Requested Date (IST)',
  'Related Order #',
  'Coins Withdrawn',
  'Cash Amount (INR)',
  'Payout Method',
  'UPI ID',
  'Payout Status',
  'Transaction / UTR Reference',
  'Rejection Reason'
];
const withdrawalRows = [];
for (const w of withdrawals) {
  const istDate = w.requestedAt ? new Date(w.requestedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
  const ref = w.transactionRefNumber || (w.tranches && w.tranches[0] && w.tranches[0].upiRef) || '';
  withdrawalRows.push([
    vikash.name,
    vikash.phone,
    w.id,
    w.requestedAt || '',
    istDate,
    w.purchaseOrderNumber || '',
    w.totalPoints || w.points || 0,
    w.totalRupees || w.amountRupees || 0,
    w.payoutMethod || 'UPI',
    w.upiId || vikash.savedUpiId,
    w.overallStatus,
    ref,
    w.rejectionReason || ''
  ]);
}
const withdrawalsCsv = [withdrawalHeaders.map(escapeCsv).join(','), ...withdrawalRows.map(r => r.map(escapeCsv).join(','))].join('\n');
fs.writeFileSync(path.join(outDir, 'vikash_patel_withdrawals.csv'), withdrawalsCsv, 'utf8');

// 4. Combined Flat CSV (The exact columns user asked: Vikash Patel, Product bought, Date, Withdrawals, Coins)
const combinedHeaders = [
  'Customer Name',
  'Phone',
  'UPI ID',
  'Record Type',
  'Reference ID',
  'Date (IST)',
  'Product / Description',
  'Quantity',
  'Amount (INR)',
  'Coins / Points',
  'Status',
  'UTR / Payout Ref'
];

const combinedRows = [];

// Orders
for (const o of orders) {
  const istDate = new Date(o.placedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  for (const item of o.items) {
    combinedRows.push([
      vikash.name,
      vikash.phone,
      vikash.savedUpiId,
      'PRODUCT PURCHASE',
      o.orderNumber,
      istDate,
      `${item.title} (Size: ${item.size}, Color: ${item.color})`,
      item.quantity,
      o.total,
      `+${o.pointsEarned} Coins Earned`,
      o.paymentStatus,
      o.utr || ''
    ]);
  }
}

// Withdrawals
for (const w of withdrawals) {
  const istDate = w.requestedAt ? new Date(w.requestedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
  const ref = w.transactionRefNumber || (w.tranches && w.tranches[0] && w.tranches[0].upiRef) || '';
  combinedRows.push([
    vikash.name,
    vikash.phone,
    w.upiId || vikash.savedUpiId,
    'WITHDRAWAL',
    w.id,
    istDate,
    `Withdrawal against Order ${w.purchaseOrderNumber || 'N/A'}`,
    '-',
    w.totalRupees || w.amountRupees || 0,
    `-${w.totalPoints || w.points} Coins`,
    w.overallStatus,
    ref
  ]);
}

// Coin Wallet Transactions (Unlocks & Credits)
for (const t of txs) {
  combinedRows.push([
    vikash.name,
    vikash.phone,
    vikash.savedUpiId,
    'COIN TRANSACTION',
    t.id,
    t.date,
    t.description,
    '-',
    t.rupeeValue || t.legacyInrValue || 0,
    `${t.points > 0 ? '+' : ''}${t.points || t.coins} Coins`,
    t.status,
    t.orderNumber || ''
  ]);
}

const combinedCsv = [combinedHeaders.map(escapeCsv).join(','), ...combinedRows.map(r => r.map(escapeCsv).join(','))].join('\n');
fs.writeFileSync(path.join(outDir, 'vikash_patel_skywear_master.csv'), combinedCsv, 'utf8');

console.log('Successfully generated all CSVs in:', outDir);


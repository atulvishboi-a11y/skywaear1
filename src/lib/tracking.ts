import type { OrderStatus, PaymentStatus, ShopOrder } from "./domain";

export interface TrackingStage {
  key: string;
  label: string;
  short: string;
  description: string;
  statuses: OrderStatus[];
}

/**
 * The six customer-facing milestones an order moves through. Internal statuses
 * APPROVED and PRINTING_POD both belong to the "Ready to Pack / Print" stage.
 */
export const TRACKING_STAGES: TrackingStage[] = [
  {
    key: "paid",
    label: "Paid Order",
    short: "Paid",
    description: "Payment received and verified.",
    statuses: ["PENDING"],
  },
  {
    key: "ready",
    label: "Ready to Pack / Print",
    short: "Ready",
    description: "Packed and queued for print-on-demand.",
    statuses: ["APPROVED", "PRINTING_POD"],
  },
  {
    key: "manifest",
    label: "Manifest Generated",
    short: "Manifest",
    description: "Courier assigned and AWB generated.",
    statuses: ["MANIFEST_GENERATED"],
  },
  {
    key: "transit",
    label: "In Transit",
    short: "Transit",
    description: "Moving through the courier network.",
    statuses: ["SHIPPED"],
  },
  {
    key: "local",
    label: "In Your Local Area",
    short: "Local",
    description: "Out for delivery from your local hub.",
    statuses: ["LOCAL_AREA"],
  },
  {
    key: "delivered",
    label: "Delivered",
    short: "Delivered",
    description: "Delivered to your doorstep.",
    statuses: ["DELIVERED"],
  },
];

const STAGE_INDEX: Record<OrderStatus, number> = {
  PENDING: 0,
  APPROVED: 1,
  PRINTING_POD: 1,
  MANIFEST_GENERATED: 2,
  SHIPPED: 3,
  LOCAL_AREA: 4,
  DELIVERED: 5,
  CANCELLED: -1,
};

export function statusStageIndex(status: OrderStatus, paymentStatus?: PaymentStatus): number {
  if (status === "CANCELLED") return -1;
  // Prepaid orders are captured at checkout, so they already clear the Paid stage
  // even while the admin queue still shows PENDING.
  if (status === "PENDING" && paymentStatus === "PAID") return 1;
  return STAGE_INDEX[status];
}

export function stageLabel(stageIndex: number, paymentStatus?: PaymentStatus): string {
  if (stageIndex === 0 && paymentStatus !== "PAID") return "Order Placed";
  return TRACKING_STAGES[stageIndex]?.label ?? "Order";
}

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "Order Placed";
    case "APPROVED":
      return "Ready to Pack";
    case "PRINTING_POD":
      return "Printing";
    case "MANIFEST_GENERATED":
      return "Manifest Generated";
    case "SHIPPED":
      return "In Transit";
    case "LOCAL_AREA":
      return "In Local Area";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function stageTimelineEvent(order: ShopOrder, stage: TrackingStage) {
  return order.timeline.find((entry) => stage.statuses.includes(entry.label as OrderStatus));
}

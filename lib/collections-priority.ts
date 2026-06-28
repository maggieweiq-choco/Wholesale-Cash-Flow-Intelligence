import type { CollectionsItem } from "@/agents/receivables-agent";

export type CollectionPriorityTier = "critical" | "high" | "monitor" | "low";

export const COLLECTION_PRIORITY_ORDER: CollectionPriorityTier[] = ["critical", "high", "monitor", "low"];

export const COLLECTION_DETAILS_BASE_PATH = "/receivables/details";

export const COLLECTION_PRIORITY_META: Record<
  CollectionPriorityTier,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClassName: string;
    panelClassName: string;
    progressClassName: string;
  }
> = {
  critical: {
    label: "Critical",
    shortLabel: "Act now",
    description: "Highest-impact overdue invoices to escalate immediately.",
    badgeClassName: "bg-red-100 text-red-700",
    panelClassName: "border-red-200 bg-red-50/70",
    progressClassName: "bg-red-500",
  },
  high: {
    label: "High",
    shortLabel: "This week",
    description: "Material exposure that should stay near the top of the queue.",
    badgeClassName: "bg-amber-100 text-amber-700",
    panelClassName: "border-amber-200 bg-amber-50/70",
    progressClassName: "bg-amber-500",
  },
  monitor: {
    label: "Monitor",
    shortLabel: "Keep warm",
    description: "Still worth following up, but not first-call priority.",
    badgeClassName: "bg-sky-100 text-sky-700",
    panelClassName: "border-sky-200 bg-sky-50/70",
    progressClassName: "bg-sky-500",
  },
  low: {
    label: "Low",
    shortLabel: "Routine",
    description: "Lowest urgency items that can sit in the routine cadence.",
    badgeClassName: "bg-slate-100 text-slate-700",
    panelClassName: "border-slate-200 bg-slate-50",
    progressClassName: "bg-slate-400",
  },
};

export function getCollectionPriorityTier(item: CollectionsItem): CollectionPriorityTier {
  let severity = 0;

  if (item.daysOverdue >= 45) severity += 3;
  else if (item.daysOverdue >= 21) severity += 2;
  else if (item.daysOverdue >= 7) severity += 1;

  if (item.amount >= 10_000) severity += 2;
  else if (item.amount >= 5_000) severity += 1;

  if (item.priorityScore >= 4_000) severity += 2;
  else if (item.priorityScore >= 1_500) severity += 1;

  if (severity >= 5) return "critical";
  if (severity >= 3) return "high";
  if (severity >= 1) return "monitor";
  return "low";
}

export function groupCollectionsByPriority(items: CollectionsItem[]) {
  return COLLECTION_PRIORITY_ORDER.map((tier) => {
    const tierItems = items.filter((item) => getCollectionPriorityTier(item) === tier);
    const totalAmount = tierItems.reduce((sum, item) => sum + item.amount, 0);

    return {
      tier,
      items: tierItems,
      count: tierItems.length,
      totalAmount,
    };
  });
}

export function getCollectionTierDetailsHref(tier: CollectionPriorityTier): string {
  return `${COLLECTION_DETAILS_BASE_PATH}/${tier}`;
}

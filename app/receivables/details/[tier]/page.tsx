import { notFound } from "next/navigation";
import { ReceivablesDetailsView } from "@/components/ReceivablesDetailsView";
import { COLLECTION_PRIORITY_ORDER, type CollectionPriorityTier } from "@/lib/collections-priority";

export default async function ReceivablesTierDetailsPage({
  params,
}: {
  params: Promise<{ tier: string }>;
}) {
  const { tier } = await params;

  if (!COLLECTION_PRIORITY_ORDER.includes(tier as CollectionPriorityTier)) {
    notFound();
  }

  return <ReceivablesDetailsView lockedTier={tier as CollectionPriorityTier} />;
}

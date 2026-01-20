"use client"

import FeedbacksModule from "@/components/modules/feedbacks-module"
import { useShopId } from "@/components/shop-context"

export default function FeedbacksPage() {
  const shopId = useShopId()
  return <FeedbacksModule shopId={shopId} />
}

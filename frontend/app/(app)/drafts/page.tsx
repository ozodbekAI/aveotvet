"use client"

import DraftsModule from "@/components/modules/drafts-module"
import { useShopId } from "@/components/shop-context"

export default function DraftsPage() {
  const shopId = useShopId()
  if (!shopId) return null
  return <DraftsModule shopId={shopId} />
}

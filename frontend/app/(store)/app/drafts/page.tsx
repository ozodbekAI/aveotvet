"use client"

import DraftsModule from "@/components/modules/drafts-module"
import { useShopId } from "@/components/shop-context"

export default function DraftsPage() {
  const shopId = useShopId()
  return <DraftsModule shopId={shopId} />
}

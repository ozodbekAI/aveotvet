"use client"

import ChatsModule from "@/components/modules/chats-module"
import { useShopId } from "@/components/shop-context"

export default function ChatPage() {
  const shopId = useShopId()
  return <ChatsModule shopId={shopId} />
}

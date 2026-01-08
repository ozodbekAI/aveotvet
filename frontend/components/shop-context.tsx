"use client"

import { createContext, useContext } from "react"

type ShopContextValue = {
  shopId: number | null
  setShopId: (shopId: number) => void
}

const ShopContext = createContext<ShopContextValue | null>(null)

export function ShopProvider({ value, children }: { value: ShopContextValue; children: React.ReactNode }) {
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShopId() {
  const ctx = useContext(ShopContext)
  if (!ctx || !ctx.shopId) {
    return null
  }
  return ctx.shopId
}

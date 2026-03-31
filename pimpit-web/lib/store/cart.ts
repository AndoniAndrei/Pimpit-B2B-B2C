import { create } from 'zustand'
import { CartItem } from '../types'

interface CartState {
  items: CartItem[]
  isOpen: boolean
  isLoading: boolean
  setItems: (items: CartItem[]) => void
  setIsOpen: (isOpen: boolean) => void
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  fetchCart: () => Promise<void>
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,
  isLoading: false,
  setItems: (items) => set({ items }),
  setIsOpen: (isOpen) => set({ isOpen }),
  addItem: (item) => {
    const current = get().items
    const existing = current.find(i => i.product_id === item.product_id)
    if (existing) {
      set({ items: current.map(i => i.product_id === item.product_id ? { ...i, quantity: i.quantity + item.quantity } : i) })
    } else {
      set({ items: [...current, item] })
    }
  },
  removeItem: (id) => set({ items: get().items.filter(i => i.id !== id) }),
  updateQuantity: (id, quantity) => set({ items: get().items.map(i => i.id === id ? { ...i, quantity } : i) }),
  clearCart: () => set({ items: [] }),
  fetchCart: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/cart')
      if (res.ok) {
        const data = await res.json()
        set({ items: data.items })
      }
    } catch (e) {
      console.error('Failed to fetch cart', e)
    } finally {
      set({ isLoading: false })
    }
  }
}))

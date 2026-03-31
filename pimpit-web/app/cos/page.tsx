'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/lib/store/cart'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'

export default function CartPage() {
  const { items, isLoading, fetchCart, removeItem } = useCartStore()

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const subtotal = items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0)

  if (isLoading) return <div className="container mx-auto py-12 text-center">Se încarcă coșul...</div>

  if (items.length === 0) {
    return (
      <div className="container mx-auto py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Coșul tău este gol</h1>
        <p className="text-muted-foreground mb-8">Nu ai adăugat niciun produs în coș încă.</p>
        <Link href="/jante" className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium">
          Înapoi la magazin
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Coș de cumpărături</h1>
      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          {items.map(item => (
            <div key={item.id} className="flex gap-6 border rounded-xl p-4 bg-card">
              <div className="w-24 h-24 relative bg-muted rounded-md shrink-0">
                {item.product.images?.[0] && (
                  <Image src={item.product.images[0]} alt="" fill className="object-cover" />
                )}
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold">{item.product.brand} {item.product.name}</h3>
                  <p className="text-sm text-muted-foreground">Cod: {item.product.part_number}</p>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-sm">Cantitate: <span className="font-bold">{item.quantity}</span></div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{formatPrice(item.product.price * item.quantity)}</div>
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="text-sm text-destructive hover:underline mt-1"
                    >
                      Șterge
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-card border rounded-xl p-6 h-fit sticky top-24">
          <h2 className="text-xl font-bold mb-6">Sumar comandă</h2>
          <div className="space-y-4 mb-6">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transport</span>
              <span className="font-medium">{subtotal > 1000 ? 'Gratuit' : formatPrice(50)}</span>
            </div>
            <div className="border-t pt-4 flex justify-between">
              <span className="font-bold text-lg">Total</span>
              <span className="font-bold text-2xl text-primary">{formatPrice(subtotal + (subtotal > 1000 ? 0 : 50))}</span>
            </div>
          </div>
          <Link 
            href="/checkout" 
            className="block w-full text-center bg-primary text-primary-foreground py-3 rounded-md font-bold hover:bg-primary/90 transition-colors"
          >
            Pasul următor
          </Link>
        </div>
      </div>
    </div>
  )
}

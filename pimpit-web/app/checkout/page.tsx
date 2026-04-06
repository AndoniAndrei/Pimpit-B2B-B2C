'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/store/cart'

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { clearCart } = useCartStore()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const address = {
      street: formData.get('street'),
      city: formData.get('city'),
      county: formData.get('county'),
      postal_code: formData.get('postal_code')
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_address: address,
          customer_name: formData.get('name'),
          customer_email: formData.get('email'),
          customer_phone: formData.get('phone'),
          payment_method: 'ramburs'
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Eroare la plasarea comenzii')
      }

      clearCart()
      alert('Comanda a fost plasată cu succes!')
      router.push('/cont')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-8">Finalizare Comandă</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-card border p-4 sm:p-6 rounded-xl">
        <div className="space-y-4">
          <h2 className="font-bold text-lg border-b pb-2">Date de contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Nume complet</label>
              <input name="name" required className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Telefon</label>
              <input name="phone" required className="w-full border rounded-md px-3 py-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">Email</label>
              <input name="email" type="email" required className="w-full border rounded-md px-3 py-2" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-bold text-lg border-b pb-2">Adresă de livrare</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">Stradă și număr</label>
              <input name="street" required className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Oraș</label>
              <input name="city" required className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Județ</label>
              <input name="county" required className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Cod poștal</label>
              <input name="postal_code" className="w-full border rounded-md px-3 py-2" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground py-4 rounded-md font-bold text-lg hover:bg-primary/90 disabled:opacity-50 mt-4"
        >
          {loading ? 'Se procesează...' : 'Plasează Comanda'}
        </button>
      </form>
    </div>
  )
}

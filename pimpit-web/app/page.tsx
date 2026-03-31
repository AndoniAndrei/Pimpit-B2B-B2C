import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <h1 className="text-5xl font-extrabold tracking-tight mb-6">
        Găsește jantele perfecte pentru mașina ta
      </h1>
      <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
        Catalog unificat cu mii de modele de la cei mai buni producători, actualizat în timp real.
      </p>
      <div className="flex gap-4">
        <Link 
          href="/jante" 
          className="bg-primary text-primary-foreground px-8 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Explorează Catalogul
        </Link>
        <Link 
          href="/auth/login" 
          className="bg-secondary text-secondary-foreground px-8 py-3 rounded-md font-medium hover:bg-secondary/80 transition-colors"
        >
          Cont B2B / B2C
        </Link>
      </div>
    </div>
  )
}

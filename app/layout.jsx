import './globals.css'

export const metadata = {
  title: 'FoxFood - Gestion de plats et liste de courses',
  description: 'Application pour gérer les plats et générer des listes de courses',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50">
        <header className="bg-orange-600 text-white shadow-md">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">🦊 FoxFood</h1>
            <p className="text-sm text-orange-100">Gestion de plats et liste de courses</p>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}

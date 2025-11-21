import './globals.css'
import SessionProvider from '@/components/SessionProvider'
import Header from '@/components/Header'

export const metadata = {
  title: 'FoxFood - Gestion de plats et liste de courses',
  description: 'Application pour gérer les plats et générer des listes de courses',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50">
        <SessionProvider>
          <Header />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  )
}

'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Header() {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  // Ne pas afficher le header sur les pages de login/register
  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  return (
    <header className="bg-orange-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex flex-col">
            <h1 className="text-2xl font-bold">🦊 FoxFood</h1>
            <p className="text-sm text-orange-100">Gestion de plats et liste de courses</p>
          </Link>

          <div className="flex items-center gap-4">
            {status === 'loading' && (
              <div className="text-sm">Chargement...</div>
            )}

            {status === 'unauthenticated' && (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-orange-700 text-white rounded-lg font-semibold hover:bg-orange-800 transition"
                >
                  Inscription
                </Link>
              </div>
            )}

            {status === 'authenticated' && session?.user && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold">{session.user.name}</p>
                  <p className="text-xs text-orange-100">{session.user.email}</p>
                </div>

                {session.user.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="px-4 py-2 bg-orange-700 text-white rounded-lg font-semibold hover:bg-orange-800 transition"
                  >
                    Admin
                  </Link>
                )}

                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition"
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

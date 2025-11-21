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
    <header className="bg-primary-600 text-white shadow-md">
      <div className="container mx-auto px-3 py-3">
        <div className="flex justify-between items-center gap-2">
          {/* Logo - compact sur mobile */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🦊</span>
            <div className="flex flex-col">
              <h1 className="text-lg md:text-xl font-bold leading-tight">FoxFood</h1>
              <p className="text-xs text-primary-100 hidden sm:block">Gestion de plats</p>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {status === 'loading' && (
              <div className="text-xs md:text-sm">...</div>
            )}

            {status === 'unauthenticated' && (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-white text-primary-600 rounded-lg text-sm font-semibold hover:bg-primary-50 transition"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-primary-700 text-white rounded-lg text-sm font-semibold hover:bg-primary-800 transition hidden sm:block"
                >
                  Inscription
                </Link>
              </div>
            )}

            {status === 'authenticated' && session?.user && (
              <div className="flex items-center gap-2">
                {/* Nom utilisateur - caché sur mobile */}
                <div className="text-right hidden lg:block">
                  <p className="font-semibold text-sm">{session.user.name}</p>
                  <p className="text-xs text-primary-100">{session.user.email}</p>
                </div>

                {/* Bouton Paramètres */}
                <Link
                  href="/parametres"
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 transition"
                  title="Paramètres"
                >
                  <span className="hidden sm:inline">Paramètres</span>
                  <span className="sm:hidden">⚙️</span>
                </Link>

                {/* Bouton Admin */}
                {session.user.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="px-3 py-1.5 md:px-4 md:py-2 bg-secondary-600 text-white rounded-lg text-sm font-semibold hover:bg-secondary-700 transition"
                  >
                    <span className="hidden sm:inline">Admin</span>
                    <span className="sm:hidden">👤</span>
                  </Link>
                )}

                {/* Bouton Déconnexion */}
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-white text-primary-600 rounded-lg text-sm font-semibold hover:bg-primary-50 transition"
                >
                  <span className="hidden sm:inline">Déconnexion</span>
                  <span className="sm:hidden">↗</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

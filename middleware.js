import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname
    const status = req.nextauth.token?.approval_status
    const role = req.nextauth.token?.role

    // Bloquer les utilisateurs pending/rejected sauf admins et page d'attente
    if (status && status !== 'approved' && role !== 'admin') {
      if (pathname !== '/en-attente') {
        return NextResponse.redirect(new URL('/en-attente', req.url))
      }
    }

    // Si l'utilisateur accède à /admin, vérifier qu'il est admin
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Si un user approuvé arrive sur /en-attente, rediriger vers home
    if (pathname === '/en-attente' && (status === 'approved' || role === 'admin')) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: [
    '/admin/:path*',
    // Protéger toutes les pages sauf login, register, api, _next, et fichiers statiques.
    //
    // `ferme.html` est exclu depuis la fermeture du site (24/09/2026) : c'est la
    // page qui annonce le déménagement vers Mijoto, et elle s'adresse justement
    // à des gens NON connectés. Sans cette exclusion, le middleware la renvoyait
    // vers la page de connexion, que la redirection de `vercel.json` renvoyait
    // vers `ferme.html` — une boucle, sur la seule page qui devait encore
    // s'afficher.
    '/((?!api|login|register|forgot-password|reset-password|ferme.html|_next/static|_next/image|favicon.ico).*)',
  ]
}

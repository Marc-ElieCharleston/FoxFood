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
    // Protéger toutes les pages sauf login, register, api, _next, et fichiers statiques
    '/((?!api|login|register|forgot-password|reset-password|_next/static|_next/image|favicon.ico).*)',
  ]
}

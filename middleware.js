import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Si l'utilisateur accède à /admin, vérifier qu'il est admin
    if (req.nextUrl.pathname.startsWith('/admin') && req.nextauth.token?.role !== 'admin') {
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
    '/((?!api|login|register|_next/static|_next/image|favicon.ico).*)',
  ]
}

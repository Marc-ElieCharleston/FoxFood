'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function PendingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.approval_status === 'approved' || session.user.role === 'admin') {
      router.push('/')
    }
  }, [session, status, router])

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  const isRejected = session.user.approval_status === 'rejected'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {isRejected ? (
          <>
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-red-600 mb-3">Accès refusé</h1>
            <p className="text-gray-700 mb-6">
              Votre demande d'accès à FoxFood n'a pas été acceptée.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Si vous pensez qu'il s'agit d'une erreur, contactez Emeric directement.
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-orange-600 mb-3">En attente de validation</h1>
            <p className="text-gray-700 mb-4">
              Bonjour <strong>{session.user.name}</strong>,
            </p>
            <p className="text-gray-700 mb-6">
              Votre compte a bien été créé. Emeric doit valider votre accès avant que
              vous puissiez utiliser FoxFood.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Vous recevrez accès à l'application dès que votre demande aura été acceptée.
            </p>
          </>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-lg transition"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}

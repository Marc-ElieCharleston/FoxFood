'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

function RejoindreContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code')

  const [inviteCode, setInviteCode] = useState(codeFromUrl || '')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [householdInfo, setHouseholdInfo] = useState(null)

  // Vérifier le code automatiquement si présent dans l'URL
  useEffect(() => {
    if (codeFromUrl && status === 'authenticated') {
      checkInviteCode(codeFromUrl)
    }
  }, [codeFromUrl, status])

  const checkInviteCode = async (code) => {
    if (!code || code.length < 6) return

    try {
      setChecking(true)
      const response = await fetch(`/api/household/join?code=${code}`)
      const data = await response.json()

      if (data.valid) {
        setHouseholdInfo(data.household)
      } else {
        setHouseholdInfo(null)
        if (code === codeFromUrl) {
          toast.error('Code d\'invitation invalide')
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleJoin = async () => {
    if (!inviteCode) {
      toast.error('Veuillez entrer un code d\'invitation')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Vous avez rejoint le foyer !')
        // Rediriger vers la page d'accueil après un court délai
        setTimeout(() => {
          router.push('/')
          router.refresh()
        }, 1500)
      } else {
        toast.error(data.error || 'Erreur lors de la jonction au foyer')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la jonction au foyer')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Chargement...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <span className="text-6xl mb-4 block">🏠</span>
          <h1 className="text-2xl font-bold mb-4">Rejoindre un foyer</h1>
          <p className="text-gray-600 mb-6">
            Connectez-vous pour rejoindre le foyer de votre partenaire.
          </p>
          {codeFromUrl && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-primary-800">
                Code d'invitation : <strong className="font-mono">{codeFromUrl}</strong>
              </p>
            </div>
          )}
          <a
            href={`/login${codeFromUrl ? `?callbackUrl=/rejoindre?code=${codeFromUrl}` : ''}`}
            className="block w-full py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700"
          >
            Se connecter
          </a>
          <p className="text-sm text-gray-500 mt-4">
            Pas encore de compte ?{' '}
            <a href={`/register${codeFromUrl ? `?callbackUrl=/rejoindre?code=${codeFromUrl}` : ''}`} className="text-primary-600 hover:underline">
              Créer un compte
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <span className="text-6xl mb-4 block">🏠</span>
          <h1 className="text-2xl font-bold">Rejoindre un foyer</h1>
          <p className="text-gray-600 mt-2">
            Entrez le code d'invitation pour rejoindre le foyer de votre partenaire
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Code d'invitation
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => {
                const code = e.target.value.toUpperCase().slice(0, 6)
                setInviteCode(code)
                if (code.length === 6) {
                  checkInviteCode(code)
                } else {
                  setHouseholdInfo(null)
                }
              }}
              placeholder="ABC123"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 uppercase"
              maxLength={6}
            />
          </div>

          {checking && (
            <div className="text-center text-gray-500 text-sm">
              Vérification du code...
            </div>
          )}

          {householdInfo && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-green-800">
                    Foyer trouvé !
                  </p>
                  <p className="text-sm text-green-700">
                    Créé par <strong>{householdInfo.creatorName}</strong>
                    {householdInfo.memberCount > 0 && (
                      <> · {householdInfo.memberCount} membre{householdInfo.memberCount > 1 ? 's' : ''}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={loading || !householdInfo}
            className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Jonction en cours...' : 'Rejoindre ce foyer'}
          </button>

          <div className="text-center">
            <button
              onClick={() => router.push('/')}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Annuler et retourner à l'accueil
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement...</p>
      </div>
    </div>
  )
}

export default function RejoindreePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RejoindreContent />
    </Suspense>
  )
}

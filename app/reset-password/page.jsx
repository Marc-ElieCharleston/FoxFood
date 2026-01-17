'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      toast.error('Token manquant')
      router.push('/forgot-password')
    }
  }, [token, router])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        toast.success('Mot de passe réinitialisé avec succès !')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        toast.error(data.error || 'Erreur lors de la réinitialisation')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la réinitialisation')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Nouveau mot de passe
            </h1>
            <p className="text-gray-600 text-sm">
              Choisissez un nouveau mot de passe sécurisé pour votre compte.
            </p>
          </div>

          {success ? (
            // Message de succès
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="text-5xl mb-4">✓</div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  Mot de passe réinitialisé !
                </h3>
                <p className="text-sm text-green-700">
                  Votre mot de passe a été modifié avec succès.<br />
                  Redirection vers la page de connexion...
                </p>
              </div>
            </div>
          ) : (
            // Formulaire
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Retapez votre mot de passe"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              {/* Indicateur de force du mot de passe */}
              {password.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    Force du mot de passe :
                  </p>
                  <div className="flex gap-1">
                    <div className={`h-1.5 flex-1 rounded ${password.length >= 6 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`h-1.5 flex-1 rounded ${password.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`h-1.5 flex-1 rounded ${password.length >= 10 && /[A-Z]/.test(password) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {password.length < 6 && 'Trop court (min 6 caractères)'}
                    {password.length >= 6 && password.length < 8 && 'Faible'}
                    {password.length >= 8 && password.length < 10 && 'Moyen'}
                    {password.length >= 10 && !/[A-Z]/.test(password) && 'Bon (ajoutez une majuscule pour plus de sécurité)'}
                    {password.length >= 10 && /[A-Z]/.test(password) && 'Fort ✓'}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  ← Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Aide */}
        {!success && (
          <div className="mt-6 bg-white/80 rounded-lg p-4">
            <p className="text-xs text-gray-600 text-center">
              <strong>Conseils de sécurité :</strong><br />
              Utilisez au moins 8 caractères avec des lettres majuscules et minuscules.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Chargement...</div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

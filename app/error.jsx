'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Erreur attrapée par error boundary:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full text-center">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Oups, quelque chose s'est mal passé
        </h2>
        <p className="text-gray-600 mb-4 text-sm">
          {error?.message || 'Une erreur inattendue est survenue.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition"
          >
            Réessayer
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  )
}

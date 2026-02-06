'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function PopupMessage() {
  const { data: session, status } = useSession()
  const [showPopup, setShowPopup] = useState(false)
  const [popupSettings, setPopupSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ne charger que si l'utilisateur est authentifié
    if (status === 'loading') return
    if (!session) {
      setLoading(false)
      return
    }

    try {
      // Vérifier si le popup a déjà été affiché dans cette session
      const popupShown = sessionStorage.getItem('foxfood_popup_shown')
      if (popupShown) {
        setLoading(false)
        return
      }
    } catch {
      // sessionStorage peut être indisponible (navigation privée, etc.)
      setLoading(false)
      return
    }

    // Charger les paramètres du popup
    fetch('/api/admin/popup-settings')
      .then(res => {
        if (!res.ok) throw new Error('API error')
        return res.json()
      })
      .then(data => {
        if (data && data.is_active && data.message) {
          setPopupSettings(data)
          setShowPopup(true)
          try {
            sessionStorage.setItem('foxfood_popup_shown', 'true')
          } catch {
            // Ignorer si sessionStorage indisponible
          }
        }
        setLoading(false)
      })
      .catch(error => {
        console.error('Erreur chargement popup:', error)
        setLoading(false)
      })
  }, [session, status])

  const handleClose = () => {
    setShowPopup(false)
  }

  if (loading || !showPopup || !popupSettings) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-t-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                🎁
              </div>
              <h2 className="text-xl font-bold">Information importante</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Fermer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {popupSettings.message}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AdminNav from '@/components/AdminNav'

export default function AdminPopupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState({
    is_active: true,
    message: ''
  })

  useEffect(() => {
    if (status === 'authenticated') {
      // Vérifier que l'utilisateur est admin
      if (session.user.role !== 'admin') {
        router.push('/')
        return
      }
      fetchSettings()
    }
  }, [status, session, router])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/popup-settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (settings.message.trim().length === 0) {
      toast.error('Le message ne peut pas être vide')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/admin/popup-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        toast.success('Paramètres enregistrés avec succès !')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    if (settings.message.trim().length === 0) {
      toast.error('Le message ne peut pas être vide')
      return
    }

    // Afficher un aperçu dans une alerte (ou on pourrait créer une modale)
    alert('📱 Aperçu du popup :\n\n' + settings.message)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">💬 Message Pop-up</h1>
          <p className="text-gray-600">
            Gérer le message qui s'affiche aux utilisateurs à chaque connexion
          </p>
        </div>

        {/* Card principale */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Toggle activation */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Statut du popup
                </h3>
                <p className="text-sm text-gray-600">
                  {settings.is_active
                    ? 'Le popup est actuellement actif et sera affiché aux utilisateurs'
                    : 'Le popup est désactivé et ne sera pas affiché'}
                </p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, is_active: !settings.is_active })}
                className={`
                  relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                  ${settings.is_active ? 'bg-green-500' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                    ${settings.is_active ? 'translate-x-7' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Message */}
          <div className="p-6">
            <label className="block mb-3">
              <span className="font-medium text-gray-900 mb-2 block">
                Message du popup
              </span>
              <span className="text-sm text-gray-600 mb-3 block">
                Ce message sera affiché à tous les utilisateurs connectés (une fois par session)
              </span>
              <textarea
                value={settings.message}
                onChange={(e) => setSettings({ ...settings, message: e.target.value })}
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                placeholder="Entrez le message à afficher..."
              />
            </label>

            <div className="text-sm text-gray-500 mt-2">
              💡 Le message supporte les sauts de ligne et les emojis
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={handlePreview}
              disabled={saving}
              className="px-5 py-2.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              👁️ Aperçu
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Enregistrement...
                </>
              ) : (
                <>
                  💾 Enregistrer
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">
                Comment ça fonctionne ?
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Le popup s'affiche automatiquement à chaque fois qu'un utilisateur se connecte</li>
                <li>• Il n'apparaît qu'une seule fois par session de navigation</li>
                <li>• Si l'utilisateur ferme son navigateur et revient, le popup s'affichera à nouveau</li>
                <li>• Vous pouvez activer/désactiver le popup à tout moment</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

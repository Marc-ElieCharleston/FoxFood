'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState({
    notification_email: '',
    notification_phone: '',
    send_email: true,
    send_sms: false,
    notify_on_selection: true,
    notify_on_missing_selection: true,
    notify_on_custom_dish: true,
    daily_summary: false,
    auto_reminder_days_before: 2
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
      const response = await fetch('/api/admin/settings')
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

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (settings.send_email && !settings.notification_email) {
      toast.error('Veuillez indiquer votre email de notification')
      return
    }

    if (settings.send_sms && !settings.notification_phone) {
      toast.error('Veuillez indiquer votre numéro de téléphone')
      return
    }

    if (!settings.send_email && !settings.send_sms) {
      toast.error('Au moins une méthode de notification doit être activée')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        toast.success('Paramètres enregistrés avec succès!')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!session || session.user.role !== 'admin') {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Paramètres Admin</h1>
        <p className="text-gray-600 text-sm">
          Configurez vos préférences de notifications et de rappels
        </p>
      </div>

      {/* Navigation admin */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => router.push('/admin')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition text-sm"
        >
          Plats du catalogue
        </button>
        <button
          onClick={() => router.push('/admin/plats-personnalises')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition text-sm"
        >
          Plats personnalisés
        </button>
        <button
          onClick={() => router.push('/admin/parametres')}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold text-sm"
        >
          Paramètres
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Section 1: Coordonnées de notification */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-bold mb-4">Coordonnées de notification</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email de notification {settings.send_email && '*'}
              </label>
              <input
                type="email"
                value={settings.notification_email}
                onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder={session?.user?.email}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de téléphone {settings.send_sms && '*'}
              </label>
              <input
                type="tel"
                value={settings.notification_phone}
                onChange={(e) => setSettings({ ...settings, notification_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="06 12 34 56 78"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Méthodes de notification */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-bold mb-4">Méthodes de notification</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.send_email}
                onChange={(e) => setSettings({ ...settings, send_email: e.target.checked })}
                className="w-5 h-5 text-orange-600"
              />
              <span className="text-sm font-medium">Recevoir les notifications par email</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.send_sms}
                onChange={(e) => setSettings({ ...settings, send_sms: e.target.checked })}
                className="w-5 h-5 text-orange-600"
              />
              <span className="text-sm font-medium">Recevoir les notifications par SMS</span>
            </label>
          </div>
        </div>

        {/* Section 3: Types de notifications */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-bold mb-4">Types de notifications à recevoir</h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_on_selection}
                onChange={(e) => setSettings({ ...settings, notify_on_selection: e.target.checked })}
                className="mt-1 w-4 h-4 text-orange-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Sélection de plats effectuée
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Recevoir une notification quand un client termine sa sélection
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_on_missing_selection}
                onChange={(e) => setSettings({ ...settings, notify_on_missing_selection: e.target.checked })}
                className="mt-1 w-4 h-4 text-orange-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Sélection manquante
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Recevoir une alerte quand un client n'a pas encore choisi ses plats
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_on_custom_dish}
                onChange={(e) => setSettings({ ...settings, notify_on_custom_dish: e.target.checked })}
                className="mt-1 w-4 h-4 text-orange-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Demande de plat personnalisé
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Recevoir une notification quand un client demande un nouveau plat
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.daily_summary}
                onChange={(e) => setSettings({ ...settings, daily_summary: e.target.checked })}
                className="mt-1 w-4 h-4 text-orange-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Résumé quotidien
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Recevoir un résumé quotidien de toutes les activités
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Section 4: Rappels automatiques */}
        <div>
          <h2 className="text-lg font-bold mb-4">Rappels automatiques</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Envoyer un rappel aux clients n'ayant pas sélectionné leurs plats
            </label>
            <select
              value={settings.auto_reminder_days_before}
              onChange={(e) => setSettings({ ...settings, auto_reminder_days_before: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="1">1 jour avant le passage</option>
              <option value="2">2 jours avant le passage</option>
              <option value="3">3 jours avant le passage</option>
              <option value="4">4 jours avant le passage</option>
              <option value="5">5 jours avant le passage</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Si un client n'a pas encore fait sa sélection, il recevra automatiquement un rappel
              selon le délai choisi.
            </p>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
          >
            Retour
          </button>
        </div>
      </form>
    </div>
  )
}

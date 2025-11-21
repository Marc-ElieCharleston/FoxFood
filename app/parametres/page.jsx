'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState({
    delivery_day: '',
    delivery_time_slot: '',
    reminder_days_before: 3,
    reminder_method: 'email',
    notification_phone: '',
    notification_email: '',
    receive_notifications: true
  })

  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const timeSlots = [
    { value: 'morning', label: 'Matin (8h-12h)' },
    { value: 'afternoon', label: 'Après-midi (14h-18h)' }
  ]

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSettings()
    }
  }, [status])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setSettings({
            delivery_day: data.delivery_day || '',
            delivery_time_slot: data.delivery_time_slot || '',
            reminder_days_before: data.reminder_days_before || 3,
            reminder_method: data.reminder_method || 'email',
            notification_phone: data.notification_phone || '',
            notification_email: data.notification_email || session?.user?.email || '',
            receive_notifications: data.receive_notifications !== false
          })
        } else {
          // Pré-remplir avec l'email de session
          setSettings(prev => ({
            ...prev,
            notification_email: session?.user?.email || ''
          }))
        }
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
    if (!settings.delivery_day || !settings.delivery_time_slot) {
      toast.error('Veuillez indiquer le jour et créneau de passage d\'Emeric')
      return
    }

    if (!settings.reminder_days_before || settings.reminder_days_before < 1 || settings.reminder_days_before > 5) {
      toast.error('Le délai de rappel doit être entre 1 et 5 jours')
      return
    }

    if (settings.reminder_method === 'sms' && !settings.notification_phone) {
      toast.error('Veuillez indiquer votre numéro de mobile pour les rappels SMS')
      return
    }

    if (settings.reminder_method === 'email' && !settings.notification_email) {
      toast.error('Veuillez indiquer votre email pour les rappels')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        toast.success('Paramètres enregistrés avec succès!')
        // Rediriger vers la page d'accueil après sauvegarde
        setTimeout(() => {
          router.push('/')
        }, 1000)
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

  if (!session) {
    router.push('/login')
    return null
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">⚙️ Paramètres</h1>
        <p className="text-gray-600 text-sm">
          Configurez vos préférences pour recevoir les services d'Emeric
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Section 1: Créneau de passage */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-bold mb-4">📅 Créneau de passage d'Emeric</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jour de passage *
              </label>
              <select
                value={settings.delivery_day}
                onChange={(e) => setSettings({ ...settings, delivery_day: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                required
              >
                <option value="">Choisir un jour...</option>
                {daysOfWeek.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Créneau horaire *
              </label>
              <div className="space-y-2">
                {timeSlots.map(slot => (
                  <label key={slot.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="time_slot"
                      value={slot.value}
                      checked={settings.delivery_time_slot === slot.value}
                      onChange={(e) => setSettings({ ...settings, delivery_time_slot: e.target.value })}
                      className="w-4 h-4 text-orange-600"
                    />
                    <span className="text-sm">{slot.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Rappels */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-bold mb-4">🔔 Rappels avant le passage</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de jours avant (1 à 5) *
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={settings.reminder_days_before}
                onChange={(e) => setSettings({ ...settings, reminder_days_before: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Vous recevrez un rappel {settings.reminder_days_before} jour(s) avant le passage d'Emeric
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Méthode de rappel *
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reminder_method"
                    value="email"
                    checked={settings.reminder_method === 'email'}
                    onChange={(e) => setSettings({ ...settings, reminder_method: e.target.value })}
                    className="w-4 h-4 text-orange-600"
                  />
                  <span className="text-sm">📧 Par email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reminder_method"
                    value="sms"
                    checked={settings.reminder_method === 'sms'}
                    onChange={(e) => setSettings({ ...settings, reminder_method: e.target.value })}
                    className="w-4 h-4 text-orange-600"
                  />
                  <span className="text-sm">📱 Par SMS</span>
                </label>
              </div>
            </div>

            {settings.reminder_method === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email de notification *
                </label>
                <input
                  type="email"
                  value={settings.notification_email}
                  onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder={session?.user?.email}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Laissez vide pour utiliser l'email de votre compte
                </p>
              </div>
            )}

            {settings.reminder_method === 'sms' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de mobile *
                </label>
                <input
                  type="tel"
                  value={settings.notification_phone}
                  onChange={(e) => setSettings({ ...settings, notification_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="06 12 34 56 78"
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Notifications */}
        <div>
          <h2 className="text-lg font-bold mb-4">📬 Notifications d'Emeric</h2>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.receive_notifications}
              onChange={(e) => setSettings({ ...settings, receive_notifications: e.target.checked })}
              className="mt-1 w-4 h-4 text-orange-600"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Recevoir les actualités et nouveautés
              </span>
              <p className="text-xs text-gray-500 mt-1">
                Emeric pourra vous envoyer des notifications pour partager de nouveaux plats,
                des offres spéciales ou des informations importantes.
              </p>
            </div>
          </label>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Enregistrement...' : '💾 Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}

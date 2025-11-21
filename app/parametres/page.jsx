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
    notification_phone: '',
    notification_phone_secondary: '',
    notification_email: '',
    receive_notifications: true
  })

  // Rappels multiples: 5, 3, et 1 jours avant
  const [reminders, setReminders] = useState({
    day5: { enabled: false, email: false, sms: false },
    day3: { enabled: true, email: true, sms: false }, // Par défaut 3 jours
    day1: { enabled: false, email: false, sms: false }
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
            notification_phone: data.notification_phone || '',
            notification_phone_secondary: data.notification_phone_secondary || '',
            notification_email: data.notification_email || session?.user?.email || '',
            receive_notifications: data.receive_notifications !== false
          })

          // Charger les rappels configurés
          if (data.reminders && Array.isArray(data.reminders)) {
            const remindersState = {
              day5: { enabled: false, email: false, sms: false },
              day3: { enabled: false, email: false, sms: false },
              day1: { enabled: false, email: false, sms: false }
            }
            data.reminders.forEach(reminder => {
              const key = `day${reminder.days_before}`
              if (remindersState[key]) {
                remindersState[key] = {
                  enabled: reminder.enabled,
                  email: reminder.send_email,
                  sms: reminder.send_sms
                }
              }
            })
            setReminders(remindersState)
          }
        } else {
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

  const handleReminderToggle = (day) => {
    setReminders(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        // Si on active, activer email par défaut
        email: !prev[day].enabled ? true : prev[day].email,
      }
    }))
  }

  const handleReminderMethodChange = (day, method, value) => {
    setReminders(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [method]: value
      }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!settings.delivery_day || !settings.delivery_time_slot) {
      toast.error('Veuillez indiquer le jour et créneau de passage d\'Emeric')
      return
    }

    // Vérifier qu'au moins un rappel est activé
    const hasReminder = reminders.day5.enabled || reminders.day3.enabled || reminders.day1.enabled
    if (!hasReminder) {
      toast.error('Veuillez activer au moins un rappel')
      return
    }

    // Vérifier que pour chaque rappel activé, au moins une méthode est choisie
    for (const [key, reminder] of Object.entries(reminders)) {
      if (reminder.enabled && !reminder.email && !reminder.sms) {
        toast.error('Chaque rappel activé doit avoir au moins une méthode (Email ou SMS)')
        return
      }
    }

    // Vérifier les coordonnées si SMS activé
    const hasSMS = Object.values(reminders).some(r => r.enabled && r.sms)
    if (hasSMS && !settings.notification_phone) {
      toast.error('Veuillez indiquer votre numéro de mobile pour les rappels SMS')
      return
    }

    // Vérifier email si Email activé
    const hasEmail = Object.values(reminders).some(r => r.enabled && r.email)
    if (hasEmail && !settings.notification_email) {
      toast.error('Veuillez indiquer votre email pour les rappels')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          reminders: [
            { days_before: 5, ...reminders.day5 },
            { days_before: 3, ...reminders.day3 },
            { days_before: 1, ...reminders.day1 }
          ]
        })
      })

      if (response.ok) {
        toast.success('Paramètres enregistrés avec succès!')
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm">{slot.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Rappels multiples */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-bold mb-4">🔔 Rappels avant le passage</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configurez vos rappels personnalisés. Vous pouvez recevoir plusieurs rappels par email et/ou SMS.
          </p>

          <div className="space-y-4">
            {/* Rappel 5 jours */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <label className="flex items-center gap-3 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminders.day5.enabled}
                  onChange={() => handleReminderToggle('day5')}
                  className="w-5 h-5 text-primary-600"
                />
                <span className="text-sm font-semibold">📅 5 jours avant le passage</span>
              </label>
              {reminders.day5.enabled && (
                <div className="ml-8 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminders.day5.email}
                      onChange={(e) => handleReminderMethodChange('day5', 'email', e.target.checked)}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-xs">📧 Par email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminders.day5.sms}
                      onChange={(e) => handleReminderMethodChange('day5', 'sms', e.target.checked)}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-xs">📱 Par SMS</span>
                  </label>
                </div>
              )}
            </div>

            {/* Rappel 3 jours */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <label className="flex items-center gap-3 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminders.day3.enabled}
                  onChange={() => handleReminderToggle('day3')}
                  className="w-5 h-5 text-primary-600"
                />
                <span className="text-sm font-semibold">📅 3 jours avant le passage</span>
              </label>
              {reminders.day3.enabled && (
                <div className="ml-8 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminders.day3.email}
                      onChange={(e) => handleReminderMethodChange('day3', 'email', e.target.checked)}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-xs">📧 Par email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminders.day3.sms}
                      onChange={(e) => handleReminderMethodChange('day3', 'sms', e.target.checked)}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-xs">📱 Par SMS</span>
                  </label>
                </div>
              )}
            </div>

            {/* Rappel 1 jour */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <label className="flex items-center gap-3 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminders.day1.enabled}
                  onChange={() => handleReminderToggle('day1')}
                  className="w-5 h-5 text-primary-600"
                />
                <span className="text-sm font-semibold">📅 1 jour avant le passage (rappel urgent)</span>
              </label>
              {reminders.day1.enabled && (
                <div className="ml-8 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminders.day1.email}
                      onChange={(e) => handleReminderMethodChange('day1', 'email', e.target.checked)}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-xs">📧 Par email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminders.day1.sms}
                      onChange={(e) => handleReminderMethodChange('day1', 'sms', e.target.checked)}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-xs">📱 Par SMS</span>
                  </label>
                </div>
              )}
            </div>

            {/* Coordonnées */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email de notification {Object.values(reminders).some(r => r.enabled && r.email) && '*'}
                </label>
                <input
                  type="email"
                  value={settings.notification_email}
                  onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder={session?.user?.email}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Utilisé pour les rappels par email
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de mobile principal {Object.values(reminders).some(r => r.enabled && r.sms) && '*'}
                </label>
                <input
                  type="tel"
                  value={settings.notification_phone}
                  onChange={(e) => setSettings({ ...settings, notification_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="06 12 34 56 78"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Numéro principal pour les rappels par SMS
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de mobile secondaire <span className="text-gray-400">(optionnel - pour couples)</span>
                </label>
                <input
                  type="tel"
                  value={settings.notification_phone_secondary}
                  onChange={(e) => setSettings({ ...settings, notification_phone_secondary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="06 98 76 54 32"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Si renseigné, les deux numéros recevront les SMS
                </p>
              </div>
            </div>
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
              className="mt-1 w-4 h-4 text-primary-600"
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
            className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

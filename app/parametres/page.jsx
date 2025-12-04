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

  // États pour le foyer
  const [household, setHousehold] = useState(null)
  const [householdLoading, setHouseholdLoading] = useState(true)
  const [regeneratingCode, setRegeneratingCode] = useState(false)
  const [leavingHousehold, setLeavingHousehold] = useState(false)

  const [settings, setSettings] = useState({
    delivery_day: '',
    delivery_time_slot: '',
    notification_phone: '',
    notification_phone_secondary: '',
    notification_email: '',
    receive_notifications: true,
    dietary_preferences: [],
    avoided_ingredients: []
  })

  const [dietaryTags, setDietaryTags] = useState([])
  const [allIngredients, setAllIngredients] = useState([])
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [showIngredientDropdown, setShowIngredientDropdown] = useState(false)

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
      fetchHousehold()
      fetchDietaryTags()
      fetchAllIngredients()
    }
  }, [status])

  const fetchDietaryTags = async () => {
    try {
      const response = await fetch('/api/tags')
      const data = await response.json()
      setDietaryTags(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erreur chargement tags:', error)
    }
  }

  const fetchAllIngredients = async () => {
    try {
      const response = await fetch('/api/ingredients?active=true')
      const data = await response.json()
      setAllIngredients(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erreur chargement ingredients:', error)
    }
  }

  const toggleDietaryPreference = (tagName) => {
    setSettings(prev => {
      const prefs = prev.dietary_preferences || []
      if (prefs.includes(tagName)) {
        return { ...prev, dietary_preferences: prefs.filter(t => t !== tagName) }
      } else {
        return { ...prev, dietary_preferences: [...prefs, tagName] }
      }
    })
  }

  const addAvoidedIngredient = (ingredient) => {
    setSettings(prev => {
      const avoided = prev.avoided_ingredients || []
      if (avoided.some(a => a.id === ingredient.id)) {
        return prev // Deja ajoute
      }
      return {
        ...prev,
        avoided_ingredients: [...avoided, { id: ingredient.id, name: ingredient.name }]
      }
    })
    setIngredientSearch('')
    setShowIngredientDropdown(false)
  }

  const removeAvoidedIngredient = (ingredientId) => {
    setSettings(prev => ({
      ...prev,
      avoided_ingredients: (prev.avoided_ingredients || []).filter(a => a.id !== ingredientId)
    }))
  }

  // Filtrer les ingredients pour la recherche
  const filteredIngredients = allIngredients.filter(ing =>
    ing.name.toLowerCase().includes(ingredientSearch.toLowerCase()) &&
    !(settings.avoided_ingredients || []).some(a => a.id === ing.id)
  ).slice(0, 8)

  const fetchHousehold = async () => {
    try {
      setHouseholdLoading(true)
      const response = await fetch('/api/household')
      if (response.ok) {
        const data = await response.json()
        setHousehold(data)
      } else if (response.status === 404) {
        setHousehold(null)
      }
    } catch (error) {
      console.error('Erreur chargement foyer:', error)
    } finally {
      setHouseholdLoading(false)
    }
  }

  const handleRegenerateCode = async () => {
    if (!confirm('Voulez-vous vraiment regénérer le code d\'invitation ? L\'ancien code ne fonctionnera plus.')) {
      return
    }

    try {
      setRegeneratingCode(true)
      const response = await fetch('/api/household/invite', { method: 'POST' })
      const data = await response.json()

      if (response.ok) {
        setHousehold(prev => ({ ...prev, inviteCode: data.inviteCode }))
        toast.success('Nouveau code généré !')
      } else {
        toast.error(data.error || 'Erreur lors de la régénération')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la régénération')
    } finally {
      setRegeneratingCode(false)
    }
  }

  const handleLeaveHousehold = async () => {
    if (!confirm('Voulez-vous vraiment quitter ce foyer ? Vous devrez créer ou rejoindre un nouveau foyer.')) {
      return
    }

    try {
      setLeavingHousehold(true)
      const response = await fetch('/api/household', { method: 'DELETE' })
      const data = await response.json()

      if (response.ok) {
        toast.success('Vous avez quitté le foyer')
        setHousehold(null)
        // Rafraîchir la page pour mettre à jour la session
        router.refresh()
      } else {
        toast.error(data.error || 'Erreur lors de la sortie du foyer')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la sortie du foyer')
    } finally {
      setLeavingHousehold(false)
    }
  }

  const copyInviteLink = () => {
    if (household?.inviteCode) {
      const link = `${window.location.origin}/rejoindre?code=${household.inviteCode}`
      navigator.clipboard.writeText(link)
      toast.success('Lien copié !')
    }
  }

  const shareViaWhatsApp = () => {
    if (household?.inviteCode) {
      const link = `${window.location.origin}/rejoindre?code=${household.inviteCode}`
      const message = `Rejoins mon foyer sur FoxFood ! Clique sur ce lien pour accéder à nos plats de la semaine : ${link}`
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    }
  }

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (data) {
          let dietaryPrefs = data.dietary_preferences || []
          if (typeof dietaryPrefs === 'string') dietaryPrefs = JSON.parse(dietaryPrefs)

          let avoidedIngs = data.avoided_ingredients || []
          if (typeof avoidedIngs === 'string') avoidedIngs = JSON.parse(avoidedIngs)

          setSettings({
            delivery_day: data.delivery_day || '',
            delivery_time_slot: data.delivery_time_slot || '',
            notification_phone: data.notification_phone || '',
            notification_phone_secondary: data.notification_phone_secondary || '',
            notification_email: data.notification_email || session?.user?.email || '',
            receive_notifications: data.receive_notifications !== false,
            dietary_preferences: dietaryPrefs,
            avoided_ingredients: avoidedIngs
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
          dietary_preferences: settings.dietary_preferences || [],
          avoided_ingredients: settings.avoided_ingredients || [],
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

        {/* Section 2: Mon foyer */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-bold mb-4">🏠 Mon foyer</h2>

          {householdLoading ? (
            <div className="text-center py-4 text-gray-500">Chargement...</div>
          ) : household ? (
            <div className="space-y-4">
              {/* Infos du foyer */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Nom du foyer</p>
                <p className="font-semibold">{household.name}</p>
              </div>

              {/* Membres */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Membres ({household.members?.length || 0})
                </p>
                <div className="space-y-2">
                  {household.members?.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-semibold">
                        {member.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {member.name}
                          {member.id === household.createdBy && (
                            <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                              Créateur
                            </span>
                          )}
                          {member.id === parseInt(session?.user?.id) && (
                            <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                              Vous
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code d'invitation */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Inviter un membre
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-gray-100 px-4 py-2 rounded-lg font-mono text-lg tracking-wider text-center">
                    {household.inviteCode}
                  </div>
                  {household.createdBy === parseInt(session?.user?.id) && (
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      disabled={regeneratingCode}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      title="Regénérer le code"
                    >
                      {regeneratingCode ? '...' : '🔄'}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    📋 Copier le lien
                  </button>
                  <button
                    type="button"
                    onClick={shareViaWhatsApp}
                    className="flex-1 py-2 px-4 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                  >
                    💬 WhatsApp
                  </button>
                </div>
              </div>

              {/* Quitter le foyer (si pas le créateur) */}
              {household.createdBy !== parseInt(session?.user?.id) && (
                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={handleLeaveHousehold}
                    disabled={leavingHousehold}
                    className="w-full py-2 px-4 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    {leavingHousehold ? 'Sortie en cours...' : '🚪 Quitter ce foyer'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-4">
                Vous n'appartenez à aucun foyer.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => router.push('/rejoindre')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                >
                  Rejoindre un foyer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Rappels multiples */}
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

        {/* Section 4: Préférences alimentaires */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-bold mb-4">🥗 Préférences alimentaires</h2>
          <p className="text-sm text-gray-600 mb-4">
            Indiquez vos restrictions alimentaires. Les plats contenant ces ingredients seront masqués ou signalés.
          </p>

          <div className="space-y-3">
            {/* Tags d'ingrédients à éviter */}
            <div className="flex flex-wrap gap-2">
              {dietaryTags.filter(tag =>
                ['porc', 'produit_laitier', 'gluten', 'poisson', 'fruits_de_mer', 'fruits_a_coque', 'oeuf'].includes(tag.name)
              ).map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleDietaryPreference(tag.name)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition border-2 ${
                    settings.dietary_preferences?.includes(tag.name)
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span>{tag.emoji}</span>
                  <span>Sans {tag.name.replace('_', ' ')}</span>
                </button>
              ))}
            </div>

            {/* Tags de préférence positive */}
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 mb-3">Préférences spécifiques :</p>
              <div className="flex flex-wrap gap-2">
                {dietaryTags.filter(tag =>
                  ['halal', 'vegetarien', 'vegan'].includes(tag.name)
                ).map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleDietaryPreference(tag.name)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition border-2 ${
                      settings.dietary_preferences?.includes(tag.name)
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span>{tag.emoji}</span>
                    <span>{tag.name.charAt(0).toUpperCase() + tag.name.slice(1)}</span>
                  </button>
                ))}
              </div>
            </div>

            {settings.dietary_preferences?.length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Vos préférences :</span>{' '}
                  {settings.dietary_preferences.map(p => p.replace('_', ' ')).join(', ')}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Les plats incompatibles seront masqués de votre catalogue.
                </p>
              </div>
            )}

            {/* Ingrédients spécifiques à éviter */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Ingrédients spécifiques à éviter (allergies) :
              </p>

              {/* Recherche d'ingrédient */}
              <div className="relative mb-3">
                <input
                  type="text"
                  value={ingredientSearch}
                  onChange={(e) => {
                    setIngredientSearch(e.target.value)
                    setShowIngredientDropdown(e.target.value.length > 0)
                  }}
                  onFocus={() => ingredientSearch.length > 0 && setShowIngredientDropdown(true)}
                  placeholder="Rechercher un ingrédient..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />

                {/* Dropdown des résultats */}
                {showIngredientDropdown && filteredIngredients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredIngredients.map(ing => (
                      <button
                        key={ing.id}
                        type="button"
                        onClick={() => addAvoidedIngredient(ing)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                      >
                        <span>{ing.name}</span>
                        {ing.dietary_tags && ing.dietary_tags.length > 0 && (
                          <span className="text-xs text-gray-400">
                            ({ing.dietary_tags.join(', ')})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Liste des ingrédients évités */}
              {settings.avoided_ingredients?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {settings.avoided_ingredients.map(ing => (
                    <span
                      key={ing.id}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                    >
                      {ing.name}
                      <button
                        type="button"
                        onClick={() => removeAvoidedIngredient(ing.id)}
                        className="ml-1 text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  Aucun ingrédient spécifique à éviter
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 5: Notifications */}
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

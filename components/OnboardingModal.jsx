'use client'

import { useState } from 'react'
import { toast } from 'sonner'

// Configuration des prix
const PRICE_PER_PERSON_PER_WEEK = 20 // euros
const BASE_PERSONS = 4 // Nombre de personnes incluses dans le forfait de base

export default function OnboardingModal({ userName, userEmail, onComplete }) {
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [showSuccess, setShowSuccess] = useState(false)
  const [inviteCode, setInviteCode] = useState(null)
  const totalSteps = 4

  // Pour rejoindre un foyer existant
  const [joinMode, setJoinMode] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joiningHousehold, setJoiningHousehold] = useState(false)
  const [householdToJoin, setHouseholdToJoin] = useState(null)
  const [checkingCode, setCheckingCode] = useState(false)

  const [formData, setFormData] = useState({
    household_name: '',
    delivery_day: '',
    delivery_time_slot: '',
    household_size: 2,
    extra_fee_accepted: false,
    notification_email: userEmail || '',
    notification_phone: '',
    reminders: {
      day5: { enabled: false, email: false, sms: false },
      day3: { enabled: true, email: true, sms: false },
      day1: { enabled: false, email: false, sms: false }
    }
  })

  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

  const handleReminderToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      reminders: {
        ...prev.reminders,
        [day]: {
          ...prev.reminders[day],
          enabled: !prev.reminders[day].enabled,
          email: !prev.reminders[day].enabled ? true : prev.reminders[day].email
        }
      }
    }))
  }

  const handleReminderMethodChange = (day, method, value) => {
    setFormData(prev => ({
      ...prev,
      reminders: {
        ...prev.reminders,
        [day]: {
          ...prev.reminders[day],
          [method]: value
        }
      }
    }))
  }

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!formData.household_name.trim()) {
        toast.error('Veuillez donner un nom a votre foyer')
        return false
      }
    }
    if (currentStep === 2) {
      if (!formData.delivery_day || !formData.delivery_time_slot) {
        toast.error('Veuillez choisir un jour et un creneau')
        return false
      }
    }
    if (currentStep === 3) {
      if (formData.household_size < 1) {
        toast.error('Le nombre de personnes doit etre au moins 1')
        return false
      }
      if (formData.household_size > 4 && !formData.extra_fee_accepted) {
        toast.error('Veuillez accepter le supplement tarifaire')
        return false
      }
    }
    if (currentStep === 4) {
      const hasReminder = formData.reminders.day5.enabled || formData.reminders.day3.enabled || formData.reminders.day1.enabled
      if (!hasReminder) {
        toast.error('Veuillez activer au moins un rappel')
        return false
      }
      const hasSMS = Object.values(formData.reminders).some(r => r.enabled && r.sms)
      if (hasSMS && !formData.notification_phone) {
        toast.error('Numero de telephone requis pour les rappels SMS')
        return false
      }
    }
    return true
  }

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, totalSteps))
    }
  }

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(step)) return

    try {
      setSaving(true)
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          reminders: [
            { days_before: 5, ...formData.reminders.day5 },
            { days_before: 3, ...formData.reminders.day3 },
            { days_before: 1, ...formData.reminders.day1 }
          ]
        })
      })

      const data = await response.json()

      if (response.ok) {
        setInviteCode(data.householdInviteCode)
        setShowSuccess(true)
      } else {
        toast.error(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const copyInviteLink = () => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/rejoindre?code=${inviteCode}`
    navigator.clipboard.writeText(link)
    toast.success('Lien copie !')
  }

  const shareWhatsApp = () => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/rejoindre?code=${inviteCode}`
    const message = `Rejoins-moi sur FoxFood pour commander nos plats ensemble ! ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  // Vérifier le code d'invitation
  const checkInviteCode = async (code) => {
    if (!code || code.length < 6) {
      setHouseholdToJoin(null)
      return
    }

    try {
      setCheckingCode(true)
      const response = await fetch(`/api/household/join?code=${code}`)
      const data = await response.json()

      if (data.valid) {
        setHouseholdToJoin(data.household)
      } else {
        setHouseholdToJoin(null)
      }
    } catch (error) {
      console.error('Erreur:', error)
      setHouseholdToJoin(null)
    } finally {
      setCheckingCode(false)
    }
  }

  // Rejoindre le foyer existant
  const handleJoinHousehold = async () => {
    if (!joinCode || !householdToJoin) return

    try {
      setJoiningHousehold(true)
      const response = await fetch('/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode })
      })

      const data = await response.json()

      if (response.ok) {
        // Marquer l'onboarding comme terminé
        await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ joinedExistingHousehold: true })
        })
        toast.success('Vous avez rejoint le foyer !')
        onComplete()
      } else {
        toast.error(data.error || 'Erreur lors de la jonction')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la jonction au foyer')
    } finally {
      setJoiningHousehold(false)
    }
  }

  // Ecran de succes
  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white text-center">
            <span className="text-5xl block mb-3">🎉</span>
            <h2 className="text-xl font-bold">C'est tout bon !</h2>
            <p className="text-green-100 text-sm mt-1">Votre foyer est configure</p>
          </div>

          <div className="p-5">
            {/* Recap */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Foyer</span>
                <span className="font-medium">{formData.household_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Passage</span>
                <span className="font-medium">
                  {formData.delivery_day} {formData.delivery_time_slot === 'morning' ? 'matin' : 'apres-midi'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Personnes</span>
                <span className="font-medium">{formData.household_size}</span>
              </div>
            </div>

            {inviteCode && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 text-center mb-3">
                  Invitez votre partenaire a rejoindre votre foyer
                </p>
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-center mb-3">
                  <p className="text-xs text-primary-600 mb-1">Code d'invitation</p>
                  <p className="text-2xl font-mono font-bold tracking-widest text-primary-600">
                    {inviteCode}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={copyInviteLink}
                    className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    📋 Copier
                  </button>
                  <button
                    onClick={shareWhatsApp}
                    className="flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                  >
                    💬 WhatsApp
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={onComplete}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700"
            >
              Choisir mes plats
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-5 text-white">
          <p className="text-primary-100 text-sm">Bienvenue {userName} !</p>
          <h2 className="text-xl font-bold">Configuration</h2>
          {/* Progress */}
          <div className="mt-4 flex gap-1.5">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i < step ? 'flex-1 bg-white' :
                  i === step ? 'flex-1 bg-white' :
                  'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Step 1: Nom du foyer ou rejoindre */}
          {step === 1 && (
            <div className="space-y-5">
              {!joinMode ? (
                <>
                  <div className="text-center">
                    <span className="text-4xl block mb-3">🏠</span>
                    <h3 className="text-lg font-bold text-gray-800">Créer votre foyer</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      Donnez un nom à votre foyer
                    </p>
                  </div>

                  <input
                    type="text"
                    value={formData.household_name}
                    onChange={(e) => setFormData({ ...formData, household_name: e.target.value })}
                    placeholder="Ex: Chez les Dupont, Notre nid..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center"
                  />

                  <div className="pt-4 border-t">
                    <p className="text-center text-sm text-gray-500 mb-3">
                      Votre partenaire a déjà un foyer ?
                    </p>
                    <button
                      type="button"
                      onClick={() => setJoinMode(true)}
                      className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
                    >
                      🔗 Rejoindre un foyer existant
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <span className="text-4xl block mb-3">🔗</span>
                    <h3 className="text-lg font-bold text-gray-800">Rejoindre un foyer</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      Entrez le code d'invitation de votre partenaire
                    </p>
                  </div>

                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase().slice(0, 6)
                      setJoinCode(code)
                      if (code.length === 6) {
                        checkInviteCode(code)
                      } else {
                        setHouseholdToJoin(null)
                      }
                    }}
                    placeholder="ABC123"
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-center text-2xl font-mono tracking-widest uppercase"
                    maxLength={6}
                  />

                  {checkingCode && (
                    <p className="text-center text-sm text-gray-500">Vérification...</p>
                  )}

                  {householdToJoin && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">✅</span>
                        <div>
                          <p className="font-semibold text-green-800">Foyer trouvé !</p>
                          <p className="text-sm text-green-700">
                            <strong>{householdToJoin.name || `Foyer de ${householdToJoin.creatorName}`}</strong>
                            {householdToJoin.memberCount > 0 && (
                              <> · {householdToJoin.memberCount} membre{householdToJoin.memberCount > 1 ? 's' : ''}</>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {householdToJoin && (
                    <button
                      type="button"
                      onClick={handleJoinHousehold}
                      disabled={joiningHousehold}
                      className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      {joiningHousehold ? 'Jonction en cours...' : '✓ Rejoindre ce foyer'}
                    </button>
                  )}

                  <div className="pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setJoinMode(false)
                        setJoinCode('')
                        setHouseholdToJoin(null)
                      }}
                      className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
                    >
                      ← Créer mon propre foyer
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Jour et creneau */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <span className="text-4xl block mb-3">📅</span>
                <h3 className="text-lg font-bold text-gray-800">Passage d'Emeric</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Quand souhaitez-vous qu'Emeric passe ?
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jour de passage
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {daysOfWeek.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setFormData({ ...formData, delivery_day: day })}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition ${
                        formData.delivery_day === day
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Creneau horaire
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, delivery_time_slot: 'morning' })}
                    className={`py-4 px-3 rounded-xl text-center transition ${
                      formData.delivery_time_slot === 'morning'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-2xl block mb-1">🌅</span>
                    <span className="font-medium text-sm">Matin</span>
                    <span className="text-xs block opacity-75">8h - 12h</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, delivery_time_slot: 'afternoon' })}
                    className={`py-4 px-3 rounded-xl text-center transition ${
                      formData.delivery_time_slot === 'afternoon'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="text-2xl block mb-1">🌇</span>
                    <span className="font-medium text-sm">Apres-midi</span>
                    <span className="text-xs block opacity-75">14h - 18h</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Nombre de personnes */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center">
                <span className="text-4xl block mb-3">👥</span>
                <h3 className="text-lg font-bold text-gray-800">Nombre de personnes</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Combien de personnes dans votre foyer ?
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-sm text-blue-800 text-center">
                  <strong>{PRICE_PER_PERSON_PER_WEEK}€ / personne / semaine</strong>
                </p>
                <p className="text-xs text-blue-600 text-center mt-1">
                  Cela determine les quantites preparees
                </p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, household_size: Math.max(1, formData.household_size - 1) })}
                  className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 text-2xl font-bold hover:bg-gray-300 transition"
                >
                  -
                </button>
                <div className="text-center px-4">
                  <span className="text-5xl font-bold text-primary-600">{formData.household_size}</span>
                  <p className="text-sm text-gray-500 mt-1">personne{formData.household_size > 1 ? 's' : ''}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, household_size: Math.min(10, formData.household_size + 1) })}
                  className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 text-2xl font-bold hover:bg-gray-300 transition"
                >
                  +
                </button>
              </div>

              {/* Affichage du prix total */}
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-center">
                <p className="text-sm text-primary-700">Estimation hebdomadaire</p>
                <p className="text-3xl font-bold text-primary-600 mt-1">
                  {formData.household_size * PRICE_PER_PERSON_PER_WEEK}€<span className="text-lg font-normal">/semaine</span>
                </p>
                <p className="text-xs text-primary-500 mt-2">
                  {formData.household_size} personne{formData.household_size > 1 ? 's' : ''} × {PRICE_PER_PERSON_PER_WEEK}€
                </p>
              </div>

              {formData.household_size > BASE_PERSONS && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800 mb-3">
                    <strong>Tarif :</strong> {PRICE_PER_PERSON_PER_WEEK}€ par personne et par semaine
                    <br />
                    <span className="text-amber-600">
                      Soit <strong>{formData.household_size * PRICE_PER_PERSON_PER_WEEK}€/semaine</strong> pour {formData.household_size} personne{formData.household_size > 1 ? 's' : ''}
                    </span>
                  </p>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-5 h-5 text-amber-600 rounded"
                      checked={formData.extra_fee_accepted}
                      onChange={(e) => setFormData({ ...formData, extra_fee_accepted: e.target.checked })}
                    />
                    <span className="text-sm text-amber-900">
                      J'accepte le tarif de {PRICE_PER_PERSON_PER_WEEK}€ par personne et par semaine
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Rappels */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center">
                <span className="text-4xl block mb-3">🔔</span>
                <h3 className="text-lg font-bold text-gray-800">Vos rappels</h3>
                <p className="text-gray-500 text-sm mt-1">
                  Quand voulez-vous etre rappele ?
                </p>
              </div>

              <div className="space-y-3">
                {/* 5 jours */}
                <div className={`border rounded-xl p-3.5 transition ${formData.reminders.day5.enabled ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.reminders.day5.enabled}
                      onChange={() => handleReminderToggle('day5')}
                      className="w-5 h-5 text-primary-600 rounded"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-sm">5 jours avant</span>
                    </div>
                  </label>
                  {formData.reminders.day5.enabled && (
                    <div className="mt-2 ml-8 flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.reminders.day5.email}
                          onChange={(e) => handleReminderMethodChange('day5', 'email', e.target.checked)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="text-xs">📧 Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.reminders.day5.sms}
                          onChange={(e) => handleReminderMethodChange('day5', 'sms', e.target.checked)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="text-xs">📱 SMS</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 3 jours */}
                <div className={`border rounded-xl p-3.5 transition ${formData.reminders.day3.enabled ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.reminders.day3.enabled}
                      onChange={() => handleReminderToggle('day3')}
                      className="w-5 h-5 text-primary-600 rounded"
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-medium text-sm">3 jours avant</span>
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Populaire</span>
                    </div>
                  </label>
                  {formData.reminders.day3.enabled && (
                    <div className="mt-2 ml-8 flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.reminders.day3.email}
                          onChange={(e) => handleReminderMethodChange('day3', 'email', e.target.checked)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="text-xs">📧 Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.reminders.day3.sms}
                          onChange={(e) => handleReminderMethodChange('day3', 'sms', e.target.checked)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="text-xs">📱 SMS</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 1 jour */}
                <div className={`border rounded-xl p-3.5 transition ${formData.reminders.day1.enabled ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.reminders.day1.enabled}
                      onChange={() => handleReminderToggle('day1')}
                      className="w-5 h-5 text-primary-600 rounded"
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-medium text-sm">1 jour avant</span>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Urgent</span>
                    </div>
                  </label>
                  {formData.reminders.day1.enabled && (
                    <div className="mt-2 ml-8 flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.reminders.day1.email}
                          onChange={(e) => handleReminderMethodChange('day1', 'email', e.target.checked)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="text-xs">📧 Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.reminders.day1.sms}
                          onChange={(e) => handleReminderMethodChange('day1', 'sms', e.target.checked)}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="text-xs">📱 SMS</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Coordonnees si SMS */}
              {Object.values(formData.reminders).some(r => r.enabled && r.sms) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numero de telephone
                  </label>
                  <input
                    type="tel"
                    value={formData.notification_phone}
                    onChange={(e) => setFormData({ ...formData, notification_phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="06 12 34 56 78"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                Retour
              </button>
            )}
            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition"
              >
                Continuer
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {saving ? 'Enregistrement...' : 'Terminer'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AdminNav from '@/components/AdminNav'

// Configuration des prix (même que OnboardingModal)
const PRICE_PER_PERSON_PER_WEEK = 20
const BASE_PERSONS = 4

export default function AdminTestPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // État pour les tests de notification
  const [notifTab, setNotifTab] = useState('onboarding') // 'onboarding' ou 'notifications'
  const [notifType, setNotifType] = useState('reminder')
  const [notifMethod, setNotifMethod] = useState('email')
  const [notifEmail, setNotifEmail] = useState('')
  const [notifPhone, setNotifPhone] = useState('')
  const [notifDays, setNotifDays] = useState(3)
  const [sendingNotif, setSendingNotif] = useState(false)

  // État pour simuler l'onboarding
  const [step, setStep] = useState(1)
  const [joinMode, setJoinMode] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [formData, setFormData] = useState({
    householdName: '',
    deliveryDay: '',
    deliveryTimeSlot: '',
    householdSize: 2,
    extraFeeAccepted: false,
    reminders: {
      day5: { enabled: false, email: false, sms: false },
      day3: { enabled: true, email: true, sms: false },
      day1: { enabled: false, email: false, sms: false }
    }
  })

  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

  useEffect(() => {
    if (status === 'authenticated') {
      if (session.user.role !== 'admin') {
        router.push('/')
      } else {
        // Pré-remplir l'email avec celui de l'admin connecté
        setNotifEmail(session.user.email)
      }
    }
  }, [status, session, router])

  // Fonction pour envoyer une notification de test
  const sendTestNotification = async () => {
    setSendingNotif(true)
    try {
      const response = await fetch('/api/admin/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: notifType,
          method: notifMethod,
          email: notifEmail,
          phone: notifPhone,
          daysBeforeDelivery: notifDays
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        if (data.results.email?.success) {
          toast.success('Email de test envoyé !')
        }
        if (data.results.sms?.success) {
          toast.success(data.results.sms.simulated ? 'SMS simulé (pas encore configuré)' : 'SMS envoyé !')
        }
      } else {
        toast.error(data.error || 'Erreur lors de l\'envoi')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de l\'envoi')
    } finally {
      setSendingNotif(false)
    }
  }

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

  const resetDemo = () => {
    setStep(1)
    setJoinMode(false)
    setJoinCode('')
    setFormData({
      householdName: '',
      deliveryDay: '',
      deliveryTimeSlot: '',
      householdSize: 2,
      extraFeeAccepted: false,
      reminders: {
        day5: { enabled: false, email: false, sms: false },
        day3: { enabled: true, email: true, sms: false },
        day1: { enabled: false, email: false, sms: false }
      }
    })
  }

  if (status === 'loading') {
    return <div className="text-center py-12">Chargement...</div>
  }

  // Rendu de chaque étape
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
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
                  value={formData.householdName}
                  onChange={(e) => setFormData({ ...formData, householdName: e.target.value })}
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

                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.householdName.trim()}
                  className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Continuer
                </button>
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
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="ABC123"
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 text-center text-2xl font-mono tracking-widest uppercase"
                  maxLength={6}
                />

                {joinCode.length === 6 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-green-800">Foyer trouvé !</p>
                        <p className="text-sm text-green-700">
                          <strong>Foyer Demo</strong> · 2 membres
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {joinCode.length === 6 && (
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition"
                  >
                    ✓ Rejoindre ce foyer
                  </button>
                )}

                <div className="pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setJoinMode(false)
                      setJoinCode('')
                    }}
                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
                  >
                    ← Créer mon propre foyer
                  </button>
                </div>
              </>
            )}
          </div>
        )

      case 2:
        return (
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
                    onClick={() => setFormData({ ...formData, deliveryDay: day })}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition ${
                      formData.deliveryDay === day
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
                Créneau horaire
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, deliveryTimeSlot: 'morning' })}
                  className={`py-4 px-3 rounded-xl text-center transition ${
                    formData.deliveryTimeSlot === 'morning'
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
                  onClick={() => setFormData({ ...formData, deliveryTimeSlot: 'afternoon' })}
                  className={`py-4 px-3 rounded-xl text-center transition ${
                    formData.deliveryTimeSlot === 'afternoon'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="text-2xl block mb-1">🌇</span>
                  <span className="font-medium text-sm">Après-midi</span>
                  <span className="text-xs block opacity-75">14h - 18h</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                Retour
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!formData.deliveryDay || !formData.deliveryTimeSlot}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Continuer
              </button>
            </div>
          </div>
        )

      case 3:
        return (
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
                Cela détermine les quantités préparées
              </p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, householdSize: Math.max(1, formData.householdSize - 1) })}
                className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 text-2xl font-bold hover:bg-gray-300 transition"
              >
                -
              </button>
              <div className="text-center px-4">
                <span className="text-5xl font-bold text-primary-600">{formData.householdSize}</span>
                <p className="text-sm text-gray-500 mt-1">personne{formData.householdSize > 1 ? 's' : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, householdSize: Math.min(10, formData.householdSize + 1) })}
                className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 text-2xl font-bold hover:bg-gray-300 transition"
              >
                +
              </button>
            </div>

            {/* Affichage du prix total */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-center">
              <p className="text-sm text-primary-700">Estimation hebdomadaire</p>
              <p className="text-3xl font-bold text-primary-600 mt-1">
                {formData.householdSize * PRICE_PER_PERSON_PER_WEEK}€<span className="text-lg font-normal">/semaine</span>
              </p>
              <p className="text-xs text-primary-500 mt-2">
                {formData.householdSize} personne{formData.householdSize > 1 ? 's' : ''} × {PRICE_PER_PERSON_PER_WEEK}€
              </p>
            </div>

            {formData.householdSize > BASE_PERSONS && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800 mb-3">
                  <strong>Tarif :</strong> {PRICE_PER_PERSON_PER_WEEK}€ par personne et par semaine
                  <br />
                  <span className="text-amber-600">
                    Soit <strong>{formData.householdSize * PRICE_PER_PERSON_PER_WEEK}€/semaine</strong> pour {formData.householdSize} personne{formData.householdSize > 1 ? 's' : ''}
                  </span>
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-5 h-5 text-amber-600 rounded"
                    checked={formData.extraFeeAccepted}
                    onChange={(e) => setFormData({ ...formData, extraFeeAccepted: e.target.checked })}
                  />
                  <span className="text-sm text-amber-900">
                    J'accepte le tarif de {PRICE_PER_PERSON_PER_WEEK}€ par personne et par semaine
                  </span>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                Retour
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={formData.householdSize > BASE_PERSONS && !formData.extraFeeAccepted}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Continuer
              </button>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-5">
            <div className="text-center">
              <span className="text-4xl block mb-3">🔔</span>
              <h3 className="text-lg font-bold text-gray-800">Vos rappels</h3>
              <p className="text-gray-500 text-sm mt-1">
                Quand voulez-vous être rappelé ?
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

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                Retour
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={!Object.values(formData.reminders).some(r => r.enabled)}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Terminer
              </button>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-5">
            <div className="text-center">
              <span className="text-5xl block mb-3">🎉</span>
              <h3 className="text-xl font-bold text-gray-800">C'est tout bon !</h3>
              <p className="text-gray-500 text-sm mt-1">Votre foyer est configuré</p>
            </div>

            {/* Récap */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Foyer</span>
                <span className="font-medium">{formData.householdName || 'Demo'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Passage</span>
                <span className="font-medium">
                  {formData.deliveryDay} {formData.deliveryTimeSlot === 'morning' ? 'matin' : 'après-midi'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Personnes</span>
                <span className="font-medium">{formData.householdSize}</span>
              </div>
            </div>

            {/* Code d'invitation */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 text-center mb-3">
                Invitez votre partenaire à rejoindre votre foyer
              </p>
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-center mb-3">
                <p className="text-xs text-primary-600 mb-1">Code d'invitation</p>
                <p className="text-2xl font-mono font-bold tracking-widest text-primary-600">
                  ABC123
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => alert('Lien copié ! (demo)')}
                  className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  📋 Copier
                </button>
                <button
                  onClick={() => alert('Ouverture WhatsApp (demo)')}
                  className="flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                >
                  💬 WhatsApp
                </button>
              </div>
            </div>

            <button
              onClick={resetDemo}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition"
            >
              Choisir mes plats (démo)
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-200px)]">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Zone de Test</h1>
        <p className="text-gray-600 text-sm">Testez l'onboarding et les notifications</p>
      </div>

      <AdminNav />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setNotifTab('onboarding')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            notifTab === 'onboarding'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📱 Onboarding
        </button>
        <button
          onClick={() => setNotifTab('notifications')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            notifTab === 'notifications'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🔔 Notifications
        </button>
      </div>

      {notifTab === 'notifications' ? (
        /* Section Test Notifications */
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold mb-6">Test des Notifications</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Configuration */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de notification
                </label>
                <select
                  value={notifType}
                  onChange={(e) => setNotifType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="reminder">Rappel client (X jours avant)</option>
                  <option value="selection">Nouvelle sélection (admin)</option>
                  <option value="missing">Sélection manquante (admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Méthode d'envoi
                </label>
                <div className="flex gap-2">
                  {['email', 'sms', 'both'].map(method => (
                    <button
                      key={method}
                      onClick={() => setNotifMethod(method)}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition ${
                        notifMethod === method
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {method === 'email' ? '📧 Email' : method === 'sms' ? '📱 SMS' : '📧+📱 Les deux'}
                    </button>
                  ))}
                </div>
              </div>

              {(notifMethod === 'email' || notifMethod === 'both') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email de destination
                  </label>
                  <input
                    type="email"
                    value={notifEmail}
                    onChange={(e) => setNotifEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {(notifMethod === 'sms' || notifMethod === 'both') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone de destination
                  </label>
                  <input
                    type="tel"
                    value={notifPhone}
                    onChange={(e) => setNotifPhone(e.target.value)}
                    placeholder="+33612345678"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ SMS simulé pour l'instant (OVH SMS à configurer)
                  </p>
                </div>
              )}

              {notifType === 'reminder' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jours avant livraison
                  </label>
                  <div className="flex gap-2">
                    {[1, 3, 5].map(days => (
                      <button
                        key={days}
                        onClick={() => setNotifDays(days)}
                        className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition ${
                          notifDays === days
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {days} jour{days > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={sendTestNotification}
                disabled={sendingNotif || (!notifEmail && notifMethod !== 'sms') || (!notifPhone && notifMethod !== 'email')}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {sendingNotif ? 'Envoi en cours...' : '🚀 Envoyer le test'}
              </button>
            </div>

            {/* Aperçu */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Aperçu du message</h3>
              <div className="bg-gray-50 rounded-xl p-4 border">
                {notifType === 'reminder' && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-800">
                      📧 Objet: Rappel: Sélectionnez vos plats - {notifDays} jour{notifDays > 1 ? 's' : ''} restant{notifDays > 1 ? 's' : ''}
                    </p>
                    <hr />
                    <div className="text-sm text-gray-600">
                      <p className="font-bold text-lg mb-2">Bonjour ! 👋</p>
                      <p>Emeric passe dans <strong>{notifDays} jour{notifDays > 1 ? 's' : ''}</strong> !</p>
                      <p className="mt-2">N'oubliez pas de sélectionner vos plats pour cette semaine.</p>
                      <div className="mt-4">
                        <span className="inline-block bg-primary-600 text-white px-4 py-2 rounded-lg text-sm">
                          Choisir mes plats
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {notifType === 'selection' && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-800">
                      📧 Objet: Un client a fait sa sélection
                    </p>
                    <hr />
                    <div className="text-sm text-gray-600">
                      <p className="font-bold text-lg mb-2">Nouvelle sélection 🎉</p>
                      <p><strong>Client Test</strong> a terminé sa sélection :</p>
                      <ul className="list-disc list-inside mt-2">
                        <li>Poulet rôti aux herbes</li>
                        <li>Gratin dauphinois</li>
                        <li>Tarte aux pommes</li>
                      </ul>
                    </div>
                  </div>
                )}
                {notifType === 'missing' && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-800">
                      📧 Objet: Client sans sélection
                    </p>
                    <hr />
                    <div className="text-sm text-gray-600">
                      <p className="font-bold text-lg mb-2">Sélection manquante ⚠️</p>
                      <p><strong>Client Test</strong> n'a pas encore sélectionné ses plats.</p>
                      <p className="mt-2">Son passage est prévu dans <strong>{notifDays} jour{notifDays > 1 ? 's' : ''}</strong>.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                <strong>💡 Info:</strong> Les emails de test sont marqués [TEST] et loggés dans la base de données.
              </div>
            </div>
          </div>
        </div>
      ) : (
      /* Section Onboarding */
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aperçu Mobile */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>📱</span> Aperçu Mobile
          </h2>
          <div className="bg-gray-900 rounded-[2.5rem] p-3 max-w-[320px] mx-auto">
            <div className="bg-white rounded-[2rem] overflow-hidden min-h-[600px]">
              {/* Barre de statut simulée */}
              <div className="bg-gray-100 px-6 py-2 flex justify-between items-center text-xs text-gray-600">
                <span>9:41</span>
                <span>FoxFood</span>
                <span>100%</span>
              </div>

              {/* Header modal */}
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white">
                <p className="text-primary-100 text-sm">Bienvenue sur FoxFood !</p>
                <h2 className="text-lg font-bold">Configuration</h2>
                {/* Progress */}
                <div className="mt-3 flex gap-1.5">
                  {[1, 2, 3, 4].map(s => (
                    <div
                      key={s}
                      className={`h-1.5 rounded-full transition-all ${
                        s < step ? 'flex-1 bg-white' :
                        s === step ? 'flex-1 bg-white' :
                        'w-1.5 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Contenu */}
              <div className="p-4">
                {renderStep()}
              </div>
            </div>
          </div>
        </div>

        {/* Infos */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>ℹ️</span> Informations
          </h2>

          <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Étapes de l'onboarding</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className={`flex items-center gap-2 ${step === 1 ? 'text-primary-600 font-medium' : ''}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step > 1 ? 'bg-green-100 text-green-600' : step === 1 ? 'bg-primary-100 text-primary-600' : 'bg-gray-100'}`}>
                    {step > 1 ? '✓' : '1'}
                  </span>
                  Nom du foyer / Rejoindre
                </li>
                <li className={`flex items-center gap-2 ${step === 2 ? 'text-primary-600 font-medium' : ''}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step > 2 ? 'bg-green-100 text-green-600' : step === 2 ? 'bg-primary-100 text-primary-600' : 'bg-gray-100'}`}>
                    {step > 2 ? '✓' : '2'}
                  </span>
                  Jour et créneau de passage
                </li>
                <li className={`flex items-center gap-2 ${step === 3 ? 'text-primary-600 font-medium' : ''}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step > 3 ? 'bg-green-100 text-green-600' : step === 3 ? 'bg-primary-100 text-primary-600' : 'bg-gray-100'}`}>
                    {step > 3 ? '✓' : '3'}
                  </span>
                  Nombre de personnes ({PRICE_PER_PERSON_PER_WEEK}€/pers/sem)
                </li>
                <li className={`flex items-center gap-2 ${step === 4 ? 'text-primary-600 font-medium' : ''}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step > 4 ? 'bg-green-100 text-green-600' : step === 4 ? 'bg-primary-100 text-primary-600' : 'bg-gray-100'}`}>
                    {step > 4 ? '✓' : '4'}
                  </span>
                  Configuration des rappels
                </li>
              </ol>
            </div>

            <hr />

            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Données actuelles</h3>
              <pre className="bg-gray-100 rounded-lg p-3 text-xs overflow-auto max-h-48">
                {JSON.stringify(formData, null, 2)}
              </pre>
            </div>

            <hr />

            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Actions</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={resetDemo}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                >
                  Réinitialiser
                </button>
                <button
                  onClick={() => setStep(Math.min(5, step + 1))}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                >
                  Étape suivante
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

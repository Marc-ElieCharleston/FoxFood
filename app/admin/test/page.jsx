'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminNav from '@/components/AdminNav'

export default function AdminTestPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // État pour simuler l'onboarding
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    householdName: '',
    deliveryDay: '',
    deliveryTimeSlot: '',
    householdSize: 2,
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
      }
    }
  }, [status, session, router])

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
    setFormData({
      householdName: '',
      deliveryDay: '',
      deliveryTimeSlot: '',
      householdSize: 2,
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
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-5xl block mb-4">🏠</span>
              <h3 className="text-xl font-bold text-gray-800">Nom de votre foyer</h3>
              <p className="text-gray-500 text-sm mt-2">
                Donnez un nom à votre foyer pour le personnaliser
              </p>
            </div>

            <div>
              <input
                type="text"
                value={formData.householdName}
                onChange={(e) => setFormData({ ...formData, householdName: e.target.value })}
                placeholder="Ex: Famille Dupont, Chez nous..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center"
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!formData.householdName.trim()}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Continuer
            </button>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-5xl block mb-4">📅</span>
              <h3 className="text-xl font-bold text-gray-800">Passage d'Emeric</h3>
              <p className="text-gray-500 text-sm mt-2">
                Quand souhaitez-vous qu'Emeric passe chez vous ?
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
                  className={`py-4 px-4 rounded-xl text-center transition ${
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
                  className={`py-4 px-4 rounded-xl text-center transition ${
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
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-5xl block mb-4">👥</span>
              <h3 className="text-xl font-bold text-gray-800">Nombre de personnes</h3>
              <p className="text-gray-500 text-sm mt-2">
                Combien de personnes mangent dans votre foyer ?
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>Info :</strong> Le nombre de personnes influence les quantités préparées par Emeric pour chaque plat.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, householdSize: Math.max(1, formData.householdSize - 1) })}
                  className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 text-2xl font-bold hover:bg-gray-300 transition"
                >
                  -
                </button>
                <div className="text-center">
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
            </div>

            {formData.householdSize > 4 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800 mb-3">
                  <strong>Tarif :</strong> 20€ par personne et par semaine
                  <br />
                  <span className="text-amber-600">
                    Soit <strong>{formData.householdSize * 20}€/semaine</strong> pour {formData.householdSize} personnes
                  </span>
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 text-primary-600"
                    checked={formData.extraFeeAccepted || false}
                    onChange={(e) => setFormData({ ...formData, extraFeeAccepted: e.target.checked })}
                  />
                  <span className="text-sm text-amber-900">
                    J'accepte le tarif de 20€ par personne et par semaine
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
                disabled={formData.householdSize > 4 && !formData.extraFeeAccepted}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Continuer
              </button>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-5xl block mb-4">🔔</span>
              <h3 className="text-xl font-bold text-gray-800">Vos rappels</h3>
              <p className="text-gray-500 text-sm mt-2">
                Configurez quand vous souhaitez être rappelé de faire votre sélection
              </p>
            </div>

            <div className="space-y-3">
              {/* Rappel 5 jours */}
              <div className={`border rounded-xl p-4 transition ${formData.reminders.day5.enabled ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.reminders.day5.enabled}
                    onChange={() => handleReminderToggle('day5')}
                    className="w-5 h-5 text-primary-600 rounded"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-sm">5 jours avant</span>
                    <p className="text-xs text-gray-500">Rappel anticipé</p>
                  </div>
                </label>
                {formData.reminders.day5.enabled && (
                  <div className="mt-3 ml-8 flex gap-4">
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

              {/* Rappel 3 jours */}
              <div className={`border rounded-xl p-4 transition ${formData.reminders.day3.enabled ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.reminders.day3.enabled}
                    onChange={() => handleReminderToggle('day3')}
                    className="w-5 h-5 text-primary-600 rounded"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-sm">3 jours avant</span>
                    <p className="text-xs text-gray-500">Rappel recommandé</p>
                  </div>
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">Populaire</span>
                </label>
                {formData.reminders.day3.enabled && (
                  <div className="mt-3 ml-8 flex gap-4">
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

              {/* Rappel 1 jour */}
              <div className={`border rounded-xl p-4 transition ${formData.reminders.day1.enabled ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.reminders.day1.enabled}
                    onChange={() => handleReminderToggle('day1')}
                    className="w-5 h-5 text-primary-600 rounded"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-sm">1 jour avant</span>
                    <p className="text-xs text-gray-500">Rappel de dernière minute</p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Urgent</span>
                </label>
                {formData.reminders.day1.enabled && (
                  <div className="mt-3 ml-8 flex gap-4">
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
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-6xl block mb-4">🎉</span>
              <h3 className="text-2xl font-bold text-gray-800">C'est tout bon !</h3>
              <p className="text-gray-500 mt-2">
                Votre foyer est configuré
              </p>
            </div>

            {/* Récap */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Foyer</span>
                <span className="font-medium">{formData.householdName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Passage</span>
                <span className="font-medium">
                  {formData.deliveryDay} {formData.deliveryTimeSlot === 'morning' ? 'matin' : 'après-midi'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Personnes</span>
                <span className="font-medium">{formData.householdSize}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Rappels</span>
                <span className="font-medium">
                  {[
                    formData.reminders.day5.enabled && '5j',
                    formData.reminders.day3.enabled && '3j',
                    formData.reminders.day1.enabled && '1j'
                  ].filter(Boolean).join(', ') || 'Aucun'}
                </span>
              </div>
            </div>

            {/* Code d'invitation simulé */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-center">
              <p className="text-sm text-primary-800 mb-2">Code d'invitation pour votre foyer</p>
              <p className="text-3xl font-mono font-bold text-primary-600 tracking-wider">ABC123</p>
              <p className="text-xs text-primary-600 mt-2">
                Partagez ce code pour inviter d'autres membres
              </p>
            </div>

            <button
              onClick={resetDemo}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition"
            >
              Recommencer la démo
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
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Test Onboarding</h1>
        <p className="text-gray-600 text-sm">Prévisualisation du parcours d'inscription</p>
      </div>

      <AdminNav />

      {/* Prévisualisation */}
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
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white text-center">
                <p className="text-sm opacity-90">Bienvenue sur FoxFood</p>
                <h2 className="text-lg font-bold">Configuration</h2>
                {/* Progress */}
                <div className="flex justify-center gap-1.5 mt-3">
                  {[1, 2, 3, 4].map(s => (
                    <div
                      key={s}
                      className={`h-1.5 rounded-full transition-all ${
                        s < step ? 'w-6 bg-white' :
                        s === step ? 'w-6 bg-white' :
                        'w-1.5 bg-white/50'
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
                  Nom du foyer
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
                  Nombre de personnes
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
    </div>
  )
}

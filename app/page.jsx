'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

export default function Home() {
  const { data: session, status } = useSession()
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDishes, setSelectedDishes] = useState([])
  const [deliveryDay, setDeliveryDay] = useState('')
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentSelection, setCurrentSelection] = useState(null)
  const [activeCategory, setActiveCategory] = useState('viandes')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSummary, setShowSummary] = useState(false)
  const [settingsCompleted, setSettingsCompleted] = useState(true)
  const [showSettingsBanner, setShowSettingsBanner] = useState(false)
  const [showCustomDishModal, setShowCustomDishModal] = useState(false)
  const [customDishFormType, setCustomDishFormType] = useState('simple') // 'simple' ou 'detailed'
  const [customDishForm, setCustomDishForm] = useState({
    dish_name: '',
    description: '',
    suggested_ingredients: []
  })
  const [newIngredient, setNewIngredient] = useState('')
  const [submittingCustomDish, setSubmittingCustomDish] = useState(false)

  const MAX_DISHES = 5

  // Charger les plats et la sélection existante
  useEffect(() => {
    if (status === 'authenticated') {
      fetchDishes()
      fetchCurrentSelection()
      checkSettings()
    }
  }, [status])

  const checkSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (!data || !data.settings_completed) {
          setSettingsCompleted(false)
          setShowSettingsBanner(true)
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des paramètres:', error)
    }
  }

  const fetchDishes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dishes?active=true')
      const data = await response.json()
      // S'assurer que data est bien un array
      setDishes(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erreur lors du chargement des plats:', error)
      setDishes([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentSelection = async () => {
    try {
      const response = await fetch('/api/selections')
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setCurrentSelection(data)
          setSelectedDishes(data.selected_dishes || [])
          setDeliveryDay(data.delivery_day || '')
          setDeliveryTimeSlot(data.delivery_time_slot || '')
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la sélection:', error)
    }
  }

  const toggleDishSelection = (dishId) => {
    setSelectedDishes(prev => {
      if (prev.includes(dishId)) {
        return prev.filter(id => id !== dishId)
      } else if (prev.length < MAX_DISHES) {
        return [...prev, dishId]
      } else {
        toast.error(`Maximum ${MAX_DISHES} plats autorisés`)
        return prev
      }
    })
  }

  const handleSaveSelection = async () => {
    if (selectedDishes.length === 0) {
      toast.error('Veuillez sélectionner au moins un plat')
      return
    }

    if (!deliveryDay || !deliveryTimeSlot) {
      toast.error('Veuillez indiquer le jour et créneau de passage')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedDishes,
          deliveryDay,
          deliveryTimeSlot
        })
      })

      if (response.ok) {
        toast.success('Sélection enregistrée avec succès!')
        fetchCurrentSelection()
        setShowSummary(false)
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

  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      setCustomDishForm(prev => ({
        ...prev,
        suggested_ingredients: [...prev.suggested_ingredients, newIngredient.trim()]
      }))
      setNewIngredient('')
    }
  }

  const handleRemoveIngredient = (index) => {
    setCustomDishForm(prev => ({
      ...prev,
      suggested_ingredients: prev.suggested_ingredients.filter((_, i) => i !== index)
    }))
  }

  const handleSubmitCustomDish = async () => {
    if (!customDishForm.dish_name.trim()) {
      toast.error('Veuillez indiquer le nom du plat')
      return
    }

    if (!customDishForm.description.trim()) {
      toast.error('Veuillez décrire le plat')
      return
    }

    try {
      setSubmittingCustomDish(true)
      const response = await fetch('/api/custom-dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_name: customDishForm.dish_name,
          description: customDishForm.description,
          suggested_ingredients: customDishFormType === 'detailed' ? customDishForm.suggested_ingredients : [],
          is_detailed: customDishFormType === 'detailed'
        })
      })

      if (response.ok) {
        toast.success('Votre demande a été envoyée à Emeric!')
        setShowCustomDishModal(false)
        setCustomDishForm({
          dish_name: '',
          description: '',
          suggested_ingredients: []
        })
        setCustomDishFormType('simple')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur lors de l\'envoi')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de l\'envoi')
    } finally {
      setSubmittingCustomDish(false)
    }
  }

  const getFilteredDishes = () => {
    let filtered = dishes.filter(dish => dish.category === activeCategory)

    if (searchQuery) {
      filtered = filtered.filter(dish =>
        dish.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }

  const categoryLabels = {
    viandes: { name: 'Viandes', emoji: '🥩', color: 'bg-red-500' },
    poissons: { name: 'Poissons', emoji: '🐟', color: 'bg-blue-500' },
    vegetation: { name: 'Végétarien', emoji: '🥗', color: 'bg-green-500' }
  }

  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const timeSlots = ['Matin (8h-12h)', 'Midi (12h-14h)', 'Après-midi (14h-18h)', 'Soir (18h-20h)']

  if (status === 'loading') {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!session) {
    return (
      <div className="text-center py-12 px-4">
        <h2 className="text-2xl font-bold mb-4">Bienvenue sur FoxFood</h2>
        <p className="text-gray-600 mb-4">
          Connectez-vous pour sélectionner vos plats de la semaine
        </p>
      </div>
    )
  }

  const filteredDishes = getFilteredDishes()

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Banner de configuration des paramètres */}
      {showSettingsBanner && (
        <div className="mb-6 bg-orange-100 border-l-4 border-orange-600 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚙️</span>
            <div className="flex-1">
              <h3 className="font-bold text-orange-900 mb-1">Configurez vos paramètres</h3>
              <p className="text-sm text-orange-800 mb-3">
                Pour profiter pleinement du service, veuillez configurer vos créneaux de passage et vos préférences de rappel.
              </p>
              <div className="flex gap-2">
                <a
                  href="/parametres"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition"
                >
                  Configurer maintenant
                </a>
                <button
                  onClick={() => setShowSettingsBanner(false)}
                  className="px-4 py-2 bg-white text-orange-800 rounded-lg text-sm font-semibold hover:bg-orange-50 transition"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bouton flottant de sélection */}
      {selectedDishes.length > 0 && (
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="fixed bottom-4 right-4 z-50 bg-orange-600 text-white px-6 py-4 rounded-full shadow-lg font-bold flex items-center gap-2 hover:bg-orange-700 transition"
        >
          <span className="text-xl">🛒</span>
          <span>{selectedDishes.length}/{MAX_DISHES}</span>
        </button>
      )}

      {/* Modal de résumé */}
      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Ma sélection</h3>
              <button
                onClick={() => setShowSummary(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {selectedDishes.length > 0 && (
              <ul className="mb-6 space-y-2">
                {selectedDishes.map(dishId => {
                  const dish = dishes.find(d => d.id === dishId)
                  return dish ? (
                    <li key={dishId} className="flex items-start gap-2 text-sm">
                      <span>{categoryLabels[dish.category].emoji}</span>
                      <span className="flex-1">{dish.name}</span>
                      <button
                        onClick={() => toggleDishSelection(dishId)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </li>
                  ) : null
                })}
              </ul>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jour de passage
                </label>
                <select
                  value={deliveryDay}
                  onChange={(e) => setDeliveryDay(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Choisir...</option>
                  {daysOfWeek.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Créneau
                </label>
                <select
                  value={deliveryTimeSlot}
                  onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Choisir...</option>
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSaveSelection}
              disabled={saving || selectedDishes.length === 0 || !deliveryDay || !deliveryTimeSlot}
              className="w-full py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement...' : '💾 Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">
          Bonjour {session.user.name}!
        </h1>
        <p className="text-sm text-gray-600">
          Choisissez vos {MAX_DISHES} plats pour cette semaine
        </p>
      </div>

      {/* Onglets de catégories - responsive */}
      <div className="flex gap-2 mb-4 justify-center">
        {Object.entries(categoryLabels).map(([category, { name, emoji, color }]) => {
          const count = dishes.filter(d => d.category === category).length
          return (
            <button
              key={category}
              onClick={() => {
                setActiveCategory(category)
                setSearchQuery('')
              }}
              className={`flex-shrink-0 px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                activeCategory === category
                  ? `${color} text-white`
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <span className="text-lg">{emoji}</span>
              {/* Mobile: juste le nombre */}
              <span className="sm:hidden text-sm font-bold">{count}</span>
              {/* Tablette/Desktop: nom + nombre */}
              <span className="hidden sm:inline text-sm font-semibold">{name} ({count})</span>
            </button>
          )
        })}
      </div>

      {/* Barre de recherche */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher un plat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Bouton demander un plat personnalisé */}
      <div className="mb-4">
        <button
          onClick={() => setShowCustomDishModal(true)}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition flex items-center justify-center gap-2"
        >
          <span className="text-xl">✨</span>
          <span>Demander un plat personnalisé</span>
        </button>
      </div>

      {/* Liste des plats */}
      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : filteredDishes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? 'Aucun plat trouvé' : 'Aucun plat dans cette catégorie'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredDishes.map(dish => {
            const isSelected = selectedDishes.includes(dish.id)
            return (
              <div
                key={dish.id}
                onClick={() => toggleDishSelection(dish.id)}
                className={`p-2.5 rounded-lg border-2 cursor-pointer transition ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-orange-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                    isSelected ? 'bg-orange-600 text-white' : 'bg-gray-200'
                  }`}>
                    {isSelected && '✓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-tight">
                      {dish.name}
                    </h3>
                    {dish.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {dish.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de demande de plat personnalisé */}
      {showCustomDishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">Demander un plat personnalisé</h3>
              <button
                onClick={() => {
                  setShowCustomDishModal(false)
                  setCustomDishForm({ dish_name: '', description: '', suggested_ingredients: [] })
                  setCustomDishFormType('simple')
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Onglets */}
            <div className="flex gap-2 mb-6 border-b">
              <button
                onClick={() => setCustomDishFormType('simple')}
                className={`px-4 py-2 font-semibold transition ${
                  customDishFormType === 'simple'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Demande simple
              </button>
              <button
                onClick={() => setCustomDishFormType('detailed')}
                className={`px-4 py-2 font-semibold transition ${
                  customDishFormType === 'detailed'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Demande détaillée
              </button>
            </div>

            {/* Formulaire */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du plat *
                </label>
                <input
                  type="text"
                  value={customDishForm.dish_name}
                  onChange={(e) => setCustomDishForm({ ...customDishForm, dish_name: e.target.value })}
                  placeholder="Ex: Poulet au curry"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={customDishForm.description}
                  onChange={(e) => setCustomDishForm({ ...customDishForm, description: e.target.value })}
                  placeholder="Décrivez le plat que vous souhaitez..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Section ingrédients suggérés (uniquement pour formulaire détaillé) */}
              {customDishFormType === 'detailed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ingrédients suggérés (optionnel)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newIngredient}
                      onChange={(e) => setNewIngredient(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddIngredient()
                        }
                      }}
                      placeholder="Ex: Poulet, curry, lait de coco..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddIngredient}
                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-semibold hover:bg-purple-200 transition"
                    >
                      Ajouter
                    </button>
                  </div>

                  {customDishForm.suggested_ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {customDishForm.suggested_ingredients.map((ingredient, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                        >
                          {ingredient}
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(index)}
                            className="text-purple-600 hover:text-purple-800 ml-1"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-900">
                  {customDishFormType === 'simple' ? (
                    <>
                      <span className="font-semibold">Demande simple :</span> Emeric recevra votre demande
                      et choisira les ingrédients lui-même selon ses inspirations et disponibilités.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">Demande détaillée :</span> Vous pouvez suggérer des
                      ingrédients spécifiques. Emeric ajustera selon les disponibilités et vous contactera
                      si nécessaire.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmitCustomDish}
                disabled={submittingCustomDish}
                className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingCustomDish ? 'Envoi...' : 'Envoyer la demande'}
              </button>
              <button
                onClick={() => {
                  setShowCustomDishModal(false)
                  setCustomDishForm({ dish_name: '', description: '', suggested_ingredients: [] })
                  setCustomDishFormType('simple')
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

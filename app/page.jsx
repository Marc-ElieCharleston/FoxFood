'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

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

  const MAX_DISHES = 5

  // Charger les plats et la sélection existante
  useEffect(() => {
    if (status === 'authenticated') {
      fetchDishes()
      fetchCurrentSelection()
    }
  }, [status])

  const fetchDishes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dishes?active=true')
      const data = await response.json()
      setDishes(data)
    } catch (error) {
      console.error('Erreur lors du chargement des plats:', error)
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
        alert(`Maximum ${MAX_DISHES} plats autorisés`)
        return prev
      }
    })
  }

  const handleSaveSelection = async () => {
    if (selectedDishes.length === 0) {
      alert('Veuillez sélectionner au moins un plat')
      return
    }

    if (!deliveryDay || !deliveryTimeSlot) {
      alert('Veuillez indiquer le jour et créneau de passage')
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
        alert('Sélection enregistrée avec succès!')
        fetchCurrentSelection()
        setShowSummary(false)
      } else {
        const data = await response.json()
        alert(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
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

      {/* Onglets de catégories */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {Object.entries(categoryLabels).map(([category, { name, emoji, color }]) => {
          const count = dishes.filter(d => d.category === category).length
          return (
            <button
              key={category}
              onClick={() => {
                setActiveCategory(category)
                setSearchQuery('')
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap ${
                activeCategory === category
                  ? `${color} text-white`
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {emoji} {name} ({count})
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

      {/* Liste des plats */}
      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : filteredDishes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? 'Aucun plat trouvé' : 'Aucun plat dans cette catégorie'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDishes.map(dish => {
            const isSelected = selectedDishes.includes(dish.id)
            return (
              <div
                key={dish.id}
                onClick={() => toggleDishSelection(dish.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-orange-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-orange-600 text-white' : 'bg-gray-200'
                  }`}>
                    {isSelected && '✓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight mb-1">
                      {dish.name}
                    </h3>
                    {dish.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">
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
    </div>
  )
}

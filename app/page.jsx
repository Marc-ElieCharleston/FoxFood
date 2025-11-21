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
        alert('Sélection enregistrée avec succès! Vous recevrez des rappels par email.')
        fetchCurrentSelection()
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

  const getDishesByCategory = (category) => {
    return dishes.filter(dish => dish.category === category)
  }

  const categoryLabels = {
    viandes: { name: 'Viandes', emoji: '🥩', color: 'red' },
    poissons: { name: 'Poissons & Fruits de mer', emoji: '🐟', color: 'blue' },
    vegetation: { name: 'Végétarien', emoji: '🥗', color: 'green' }
  }

  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const timeSlots = ['Matin (8h-12h)', 'Midi (12h-14h)', 'Après-midi (14h-18h)', 'Soir (18h-20h)']

  if (status === 'loading') {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Bienvenue sur FoxFood</h2>
        <p className="text-gray-600 mb-4">
          Connectez-vous pour sélectionner vos plats de la semaine
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Bienvenue {session.user.name}!
        </h1>
        <p className="text-gray-600">
          Sélectionnez vos {MAX_DISHES} plats préférés pour cette semaine
        </p>
      </div>

      {/* Résumé sélection */}
      <div className="mb-8 bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg border-2 border-orange-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg mb-2">
              📋 Votre sélection ({selectedDishes.length}/{MAX_DISHES})
            </h3>
            {selectedDishes.length > 0 && (
              <ul className="text-sm space-y-1">
                {selectedDishes.map(dishId => {
                  const dish = dishes.find(d => d.id === dishId)
                  return dish ? (
                    <li key={dishId} className="flex items-center gap-2">
                      <span>{categoryLabels[dish.category].emoji}</span>
                      <span>{dish.name}</span>
                    </li>
                  ) : null
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Jour et créneau */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jour de passage d'Emeric
            </label>
            <select
              value={deliveryDay}
              onChange={(e) => setDeliveryDay(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Choisir un jour...</option>
              {daysOfWeek.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Créneau horaire
            </label>
            <select
              value={deliveryTimeSlot}
              onChange={(e) => setDeliveryTimeSlot(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Choisir un créneau...</option>
              {timeSlots.map(slot => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSaveSelection}
          disabled={saving || selectedDishes.length === 0 || !deliveryDay || !deliveryTimeSlot}
          className="w-full md:w-auto px-6 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? 'Enregistrement...' : '💾 Enregistrer ma sélection'}
        </button>

        {currentSelection && (
          <p className="text-sm text-gray-600 mt-2">
            Dernière modification: {new Date(currentSelection.updated_at).toLocaleString('fr-FR')}
          </p>
        )}
      </div>

      {/* Catalogue par catégorie */}
      {loading ? (
        <div className="text-center py-8">Chargement des plats...</div>
      ) : dishes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Aucun plat disponible pour le moment
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(categoryLabels).map(([category, { name, emoji, color }]) => {
            const categoryDishes = getDishesByCategory(category)
            if (categoryDishes.length === 0) return null

            return (
              <div key={category}>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <span>{emoji}</span>
                  <span>{name}</span>
                  <span className="text-sm font-normal text-gray-500">
                    ({categoryDishes.length} plats)
                  </span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryDishes.map(dish => {
                    const isSelected = selectedDishes.includes(dish.id)
                    return (
                      <div
                        key={dish.id}
                        onClick={() => toggleDishSelection(dish.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-sm leading-tight flex-1">
                            {dish.name}
                          </h3>
                          <div className={`ml-2 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-orange-600 text-white' : 'bg-gray-200'
                          }`}>
                            {isSelected && '✓'}
                          </div>
                        </div>
                        {dish.description && (
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {dish.description}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

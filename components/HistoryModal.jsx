'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

const ingredientCategoryLabels = {
  viande: { name: 'Viandes', emoji: '🥩' },
  poisson: { name: 'Poissons', emoji: '🐟' },
  legume: { name: 'Légumes', emoji: '🥕' },
  fruit: { name: 'Fruits', emoji: '🍎' },
  feculent: { name: 'Féculents', emoji: '🍞' },
  produit_laitier: { name: 'Produits laitiers', emoji: '🥛' },
  oeuf: { name: 'Oeufs', emoji: '🥚' },
  epice: { name: 'Épices', emoji: '🌶️' },
  condiment: { name: 'Condiments', emoji: '🫒' },
  fruits_a_coque: { name: 'Fruits à coque', emoji: '🥜' },
  surgele: { name: 'Surgelés', emoji: '❄️' },
  autre: { name: 'Autres', emoji: '📦' }
}

export default function HistoryModal({ isOpen, onClose, userHouseholdSize = 1 }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [shoppingList, setShoppingList] = useState(null)
  const [loadingList, setLoadingList] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchHistory()
    }
  }, [isOpen])

  useEffect(() => {
    if (history.length > 0 && history[currentIndex]) {
      fetchShoppingList(history[currentIndex])
    }
  }, [currentIndex, history])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/selections/history')
      if (response.ok) {
        const data = await response.json()
        setHistory(data.history || [])
        setCurrentIndex(0)
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors du chargement de l\'historique')
    } finally {
      setLoading(false)
    }
  }

  const fetchShoppingList = async (weekData) => {
    if (!weekData || !weekData.dishes || weekData.dishes.length === 0) {
      setShoppingList(null)
      return
    }

    setLoadingList(true)
    try {
      const response = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dishes: weekData.dishes.map(d => d.id),
          variants: weekData.selected_variants || {},
          householdSize: userHouseholdSize
        })
      })

      if (response.ok) {
        const data = await response.json()
        setShoppingList(data)
      }
    } catch (error) {
      console.error('Erreur liste courses:', error)
    } finally {
      setLoadingList(false)
    }
  }

  const handleResendEmail = async () => {
    if (!history[currentIndex]) return

    setSendingEmail(true)
    try {
      const weekData = history[currentIndex]
      const response = await fetch('/api/shopping-list/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dishes: weekData.dishes.map(d => d.id),
          variants: weekData.selected_variants || {},
          householdSize: userHouseholdSize,
          weekDate: weekData.week_start
        })
      })

      if (response.ok) {
        toast.success('Liste envoyée par email !')
      } else {
        throw new Error('Erreur envoi')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de l\'envoi')
    } finally {
      setSendingEmail(false)
    }
  }

  const formatWeekDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const options = { day: 'numeric', month: 'long', year: 'numeric' }
    return `Semaine du ${date.toLocaleDateString('fr-FR', options)}`
  }

  const goToPrevious = () => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goToNext = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  if (!isOpen) return null

  const currentWeek = history[currentIndex]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Historique des commandes</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            >
              ✕
            </button>
          </div>

          {/* Navigation semaines */}
          {!loading && history.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={goToPrevious}
                disabled={currentIndex >= history.length - 1}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ←
              </button>
              <div className="text-center">
                <p className="text-sm opacity-80">
                  {currentIndex + 1} / {history.length}
                </p>
                <p className="font-semibold">
                  {formatWeekDate(currentWeek?.week_start)}
                </p>
              </div>
              <button
                onClick={goToNext}
                disabled={currentIndex <= 0}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Chargement...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-4">📭</p>
              <p>Aucune commande passée</p>
            </div>
          ) : (
            <>
              {/* Plats sélectionnés */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span>🍽️</span>
                  Plats sélectionnés ({currentWeek?.dishes?.length || 0})
                </h3>
                <div className="space-y-2">
                  {currentWeek?.dishes?.map((dish, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 rounded-lg p-3 flex items-center gap-3"
                    >
                      <span className="text-lg">
                        {dish.category === 'viandes' ? '🥩' :
                         dish.category === 'poissons' ? '🐟' :
                         dish.category === 'plats_complets' ? '🍲' : '🥗'}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{dish.name}</p>
                        {dish.variant_name && (
                          <p className="text-xs text-gray-500">{dish.variant_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Liste des ingrédients */}
              <div className="mb-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span>🥕</span>
                  Liste de courses
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {userHouseholdSize} pers.
                  </span>
                </h3>

                {loadingList ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Chargement de la liste...
                  </div>
                ) : !shoppingList || Object.keys(shoppingList).length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    Aucun ingrédient disponible
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(shoppingList)
                      .sort(([a], [b]) => {
                        const order = ['viande', 'poisson', 'legume', 'fruit', 'feculent', 'produit_laitier', 'oeuf', 'epice', 'condiment', 'autre']
                        return order.indexOf(a) - order.indexOf(b)
                      })
                      .map(([category, ingredients]) => (
                        <div key={category} className="bg-gray-50 rounded-lg p-3">
                          <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <span>{ingredientCategoryLabels[category]?.emoji || '📦'}</span>
                            {ingredientCategoryLabels[category]?.name || category}
                          </h5>
                          <ul className="space-y-1">
                            {ingredients.map((ing, idx) => (
                              <li key={idx} className="text-sm flex justify-between">
                                <span>{ing.name}</span>
                                {category !== 'epice' && ing.quantity && (
                                  <span className="text-gray-500">
                                    {ing.quantity % 1 === 0 ? ing.quantity : ing.quantity.toFixed(1)}
                                    {ing.unit && ` ${ing.unit}`}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && history.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={handleResendEmail}
              disabled={sendingEmail}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sendingEmail ? (
                <>Envoi en cours...</>
              ) : (
                <>
                  <span>📧</span>
                  Renvoyer par email
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { generateAdminWeeklyRecapPDF } from '@/lib/pdf-generator'
import AdminNav from '@/components/AdminNav'

export default function AdminRecapPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [weekData, setWeekData] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(0) // 0 = cette semaine
  const [availableWeeks, setAvailableWeeks] = useState([])

  useEffect(() => {
    if (status === 'authenticated') {
      if (session.user.role !== 'admin') {
        router.push('/')
        return
      }
      fetchWeekData()
    }
  }, [status, session, router, selectedWeek])

  const fetchWeekData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/recap?week=${selectedWeek}`)
      if (response.ok) {
        const data = await response.json()
        setWeekData(data)
        if (data.availableWeeks) {
          setAvailableWeeks(data.availableWeeks)
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  // Regrouper les catégories en rayons de courses
  const shoppingCategories = {
    frais: {
      name: 'Frais',
      emoji: '🥩',
      categories: ['viande', 'poisson', 'produit_laitier', 'oeuf']
    },
    legumes: {
      name: 'Légumes & Fruits',
      emoji: '🥬',
      categories: ['legume', 'fruit']
    },
    epicerie: {
      name: 'Épicerie',
      emoji: '🛒',
      categories: ['feculent', 'epice', 'condiment', 'fruits_a_coque', 'autre']
    },
    surgeles: {
      name: 'Surgelés',
      emoji: '❄️',
      categories: ['surgele']
    }
  }

  const shoppingOrder = ['frais', 'legumes', 'epicerie', 'surgeles']

  // Fonction pour regrouper les ingrédients par rayon
  const getShoppingItems = (shoppingCat) => {
    if (!weekData?.ingredients) return []
    const { categories } = shoppingCategories[shoppingCat]
    const items = []
    categories.forEach(cat => {
      if (weekData.ingredients[cat]) {
        items.push(...weekData.ingredients[cat].map(i => ({ ...i, category: cat })))
      }
    })
    return items.sort((a, b) => a.name.localeCompare(b.name))
  }

  if (status === 'loading' || loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!session || session.user.role !== 'admin') {
    return null
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  }

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-200px)]">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">📋 Récap de la semaine</h1>
        <p className="text-gray-600 text-sm">
          Vue d'ensemble des commandes et liste des courses
        </p>
      </div>

      <AdminNav />

      {/* Sélecteur de semaine */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm text-gray-600">Semaine :</span>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(weekOffset => {
            const weekDate = new Date()
            weekDate.setDate(weekDate.getDate() + (weekOffset * 7) - weekDate.getDay() + 1)
            return (
              <button
                key={weekOffset}
                onClick={() => setSelectedWeek(weekOffset)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  selectedWeek === weekOffset
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {weekOffset === 0 ? 'Cette semaine' : `+${weekOffset} sem.`}
              </button>
            )
          })}
        </div>
      </div>

      {weekData && (
        <>
          {/* Infos semaine */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="font-bold text-lg">
                  Semaine du {formatDate(weekData.weekStart)}
                </h2>
                <p className="text-sm text-gray-500">
                  au {formatDate(weekData.weekEnd)}
                </p>
              </div>
              <div className="flex gap-4 text-center">
                <div className="bg-primary-50 px-4 py-2 rounded-lg">
                  <p className="text-2xl font-bold text-primary-600">{weekData.totalClients || 0}</p>
                  <p className="text-xs text-gray-600">Clients</p>
                </div>
                <div className="bg-green-50 px-4 py-2 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{weekData.totalDishes || 0}</p>
                  <p className="text-xs text-gray-600">Plats</p>
                </div>
                <div className="bg-amber-50 px-4 py-2 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{weekData.totalPersons || 0}</p>
                  <p className="text-xs text-gray-600">Couverts</p>
                </div>
                <button
                  onClick={() => {
                    const doc = generateAdminWeeklyRecapPDF({
                      weekStart: weekData.weekStart,
                      weekEnd: weekData.weekEnd,
                      clients: weekData.clients || [],
                      ingredients: weekData.ingredients || {},
                      totalDishes: weekData.totalDishes || 0,
                      totalPersons: weekData.totalPersons || 0
                    })
                    doc.save(`foxfood-recap-${weekData.weekStart}.pdf`)
                    toast.success('PDF téléchargé!')
                  }}
                  className="bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition flex flex-col items-center justify-center"
                  title="Télécharger le récap en PDF"
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-xs text-gray-600">PDF</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Liste des clients */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-bold text-lg mb-4">👥 Commandes par client</h3>

              {weekData.clients?.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Aucune commande pour cette semaine
                </p>
              ) : (
                <div className="space-y-4">
                  {weekData.clients?.map(client => (
                    <div key={client.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold">{client.name}</p>
                          <p className="text-xs text-gray-500">{client.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm bg-primary-100 text-primary-700 px-2 py-1 rounded">
                            {client.dishes?.length || 0} plats
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {client.householdSize} pers.
                          </p>
                        </div>
                      </div>

                      {client.dishes?.length > 0 && (
                        <ul className="text-sm space-y-1 border-t pt-2 mt-2">
                          {client.dishes.map((dish, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <span className="text-gray-400">•</span>
                              <span>{dish.name}</span>
                              {dish.variantName && dish.variantName !== 'Classique' && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                  {dish.variantName}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                        📅 {client.deliveryDay} • {client.deliveryTime === 'morning' ? 'Matin' : 'Après-midi'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Liste des courses */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-bold text-lg mb-4">🛒 Liste des courses</h3>

              {!weekData.ingredients || Object.keys(weekData.ingredients).length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Aucun ingrédient pour cette semaine
                </p>
              ) : (
                <div className="space-y-4">
                  {shoppingOrder
                    .filter(shoppingCat => getShoppingItems(shoppingCat).length > 0)
                    .map(shoppingCat => {
                      const items = getShoppingItems(shoppingCat)
                      const { name, emoji } = shoppingCategories[shoppingCat]
                      return (
                        <div key={shoppingCat} className="border rounded-lg p-3">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <span>{emoji}</span>
                            {name}
                          </h4>
                          <ul className="space-y-1">
                            {items.map((ing, idx) => (
                              <li key={idx} className="text-sm flex justify-between">
                                <span>{ing.name}</span>
                                {ing.totalQuantity > 0 && ing.category !== 'epice' && (
                                  <span className="text-gray-500 font-medium">
                                    {ing.totalQuantity % 1 === 0 ? ing.totalQuantity : ing.totalQuantity.toFixed(1)}
                                    {ing.unit && ` ${ing.unit}`}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

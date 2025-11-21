'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDish, setEditingDish] = useState(null)
  const [importing, setImporting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    category: 'viandes',
    description: '',
    active: true
  })

  // Vérifier que l'utilisateur est admin
  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'admin') {
      router.push('/')
    }
  }, [session, status, router])

  // Charger les plats
  useEffect(() => {
    fetchDishes()
  }, [])

  const fetchDishes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dishes')
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

  const handleImport = async () => {
    if (!confirm('Importer tous les plats du catalogue? Cette action ajoutera environ 80 plats.')) {
      return
    }

    try {
      setImporting(true)
      const response = await fetch('/api/dishes/import', {
        method: 'POST'
      })
      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        fetchDishes()
      } else {
        toast.error(data.error || 'Erreur lors de l\'importation')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de l\'importation')
    } finally {
      setImporting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const url = editingDish ? '/api/dishes' : '/api/dishes'
    const method = editingDish ? 'PUT' : 'POST'
    const body = editingDish
      ? { ...formData, id: editingDish.id }
      : formData

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        toast.success(editingDish ? 'Plat modifié!' : 'Plat créé!')
        setShowForm(false)
        setEditingDish(null)
        setFormData({ name: '', category: 'viandes', description: '', active: true })
        fetchDishes()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const handleEdit = (dish) => {
    setEditingDish(dish)
    setFormData({
      name: dish.name,
      category: dish.category,
      description: dish.description || '',
      active: dish.active
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce plat?')) return

    try {
      const response = await fetch(`/api/dishes?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Plat supprimé!')
        fetchDishes()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  const filteredDishes = dishes.filter(dish => {
    // Filtre par catégorie
    const matchesCategory = filter === 'all' || dish.category === filter

    // Filtre par recherche
    const matchesSearch = !searchQuery ||
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dish.description && dish.description.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesCategory && matchesSearch
  })

  const categoryLabels = {
    viandes: 'Viandes',
    poissons: 'Poissons',
    vegetation: 'Végétarien'
  }

  if (status === 'loading' || !session) {
    return <div className="text-center py-8">Chargement...</div>
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Administration FoxFood</h1>
        <p className="text-gray-600">Gestion des plats du catalogue</p>
      </div>

      {/* Actions */}
      <div className="mb-6 space-y-3">
        {/* Boutons d'action principaux */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingDish(null)
              setFormData({ name: '', category: 'viandes', description: '', active: true })
              setShowForm(true)
            }}
            className="px-3 py-2 md:px-4 md:py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold text-sm"
          >
            <span className="hidden sm:inline">➕ Nouveau plat</span>
            <span className="sm:hidden">➕ Nouveau</span>
          </button>

          {dishes.length === 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm disabled:opacity-50"
            >
              {importing ? 'Import...' : '📥 Importer (74 plats)'}
            </button>
          )}
        </div>

        {/* Filtres de catégorie */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${filter === 'all' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            <span className="hidden sm:inline">Tous ({dishes.length})</span>
            <span className="sm:hidden">Tous {dishes.length}</span>
          </button>
          {['viandes', 'poissons', 'vegetation'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${filter === cat ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              {/* Tablette/Desktop: texte complet */}
              <span className="hidden sm:inline">{categoryLabels[cat]} ({dishes.filter(d => d.category === cat).length})</span>
              {/* Mobile: première lettre + nombre */}
              <span className="sm:hidden">{categoryLabels[cat][0]} {dishes.filter(d => d.category === cat).length}</span>
            </button>
          ))}
        </div>

        {/* Barre de recherche */}
        <div className="w-full">
          <input
            type="text"
            placeholder="🔍 Rechercher un plat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingDish ? 'Modifier le plat' : 'Nouveau plat'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du plat *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="viandes">Viandes</option>
                  <option value="poissons">Poissons</option>
                  <option value="vegetation">Végétarien</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                rows={3}
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  Actif (visible pour les clients)
                </span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold"
              >
                {editingDish ? 'Modifier' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingDish(null)
                  setFormData({ name: '', category: 'viandes', description: '', active: true })
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des plats */}
      {loading ? (
        <div className="text-center py-8">Chargement des plats...</div>
      ) : filteredDishes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Aucun plat trouvé. {dishes.length === 0 && "Cliquez sur 'Importer le catalogue' pour commencer."}
        </div>
      ) : (
        <>
          {/* Vue mobile/tablette - Cards */}
          <div className="lg:hidden space-y-3">
            {filteredDishes.map(dish => (
              <div
                key={dish.id}
                className={`bg-white rounded-lg shadow-md p-4 ${!dish.active ? 'opacity-50' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">{dish.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        dish.category === 'viandes' ? 'bg-red-100 text-red-800' :
                        dish.category === 'poissons' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {categoryLabels[dish.category]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {dish.active ? '✅' : '❌'}
                      </span>
                    </div>
                    {dish.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">{dish.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleEdit(dish)}
                    className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(dish.id)}
                    className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-semibold"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Vue desktop - Table */}
          <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catégorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDishes.map(dish => (
                  <tr key={dish.id} className={!dish.active ? 'opacity-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {dish.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        dish.category === 'viandes' ? 'bg-red-100 text-red-800' :
                        dish.category === 'poissons' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {categoryLabels[dish.category]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                      {dish.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dish.active ? '✅ Actif' : '❌ Inactif'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(dish)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(dish.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

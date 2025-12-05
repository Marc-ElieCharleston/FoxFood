'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AdminNav from '@/components/AdminNav'

export default function IngredientsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [ingredients, setIngredients] = useState([])
  const [dietaryTags, setDietaryTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    default_unit: 'g',
    dietary_tags: [],
    category: 'legume',
    active: true
  })

  const unitOptions = [
    { value: 'g', label: 'Grammes (g)' },
    { value: 'kg', label: 'Kilogrammes (kg)' },
    { value: 'ml', label: 'Millilitres (ml)' },
    { value: 'L', label: 'Litres (L)' },
    { value: 'piece', label: 'Piece' },
    { value: 'gousse', label: 'Gousse' },
    { value: 'c.a.s', label: 'Cuillere a soupe' },
    { value: 'c.a.c', label: 'Cuillere a cafe' },
  ]

  const categoryOptions = [
    { value: 'viande', label: 'Viande', emoji: '🥩' },
    { value: 'poisson', label: 'Poisson', emoji: '🐟' },
    { value: 'produit_laitier', label: 'Produit laitier', emoji: '🥛' },
    { value: 'feculent', label: 'Feculent', emoji: '🍞' },
    { value: 'legume', label: 'Legume', emoji: '🥕' },
    { value: 'fruit', label: 'Fruit', emoji: '🍎' },
    { value: 'fruits_a_coque', label: 'Fruits a coque', emoji: '🥜' },
    { value: 'oeuf', label: 'Oeuf', emoji: '🥚' },
    { value: 'epice', label: 'Epice', emoji: '🌶️' },
    { value: 'condiment', label: 'Condiment', emoji: '🫒' },
    { value: 'autre', label: 'Autre', emoji: '📦' },
  ]

  // Vérifier que l'utilisateur est admin
  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'admin') {
      router.push('/')
    }
  }, [session, status, router])

  useEffect(() => {
    fetchIngredients()
    fetchDietaryTags()
  }, [])

  const fetchIngredients = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/ingredients')
      const data = await response.json()
      setIngredients(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erreur:', error)
      setIngredients([])
    } finally {
      setLoading(false)
    }
  }

  const fetchDietaryTags = async () => {
    try {
      const response = await fetch('/api/tags')
      const data = await response.json()
      setDietaryTags(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const toggleTag = (tagName) => {
    setFormData(prev => {
      const tags = prev.dietary_tags || []
      if (tags.includes(tagName)) {
        return { ...prev, dietary_tags: tags.filter(t => t !== tagName) }
      } else {
        return { ...prev, dietary_tags: [...tags, tagName] }
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const url = '/api/ingredients'
    const method = editingIngredient ? 'PUT' : 'POST'
    const body = editingIngredient
      ? { ...formData, id: editingIngredient.id }
      : formData

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        toast.success(editingIngredient ? 'Ingredient modifie!' : 'Ingredient cree!')
        setShowForm(false)
        setEditingIngredient(null)
        setFormData({ name: '', default_unit: 'g', dietary_tags: [], category: 'legume', active: true })
        fetchIngredients()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const handleEdit = (ingredient) => {
    setEditingIngredient(ingredient)
    let tags = ingredient.dietary_tags || []
    if (typeof tags === 'string') tags = JSON.parse(tags)
    setFormData({
      name: ingredient.name,
      default_unit: ingredient.default_unit || 'g',
      dietary_tags: tags,
      category: ingredient.category || 'autre',
      active: ingredient.active
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet ingredient?')) return

    try {
      const response = await fetch(`/api/ingredients?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Ingredient supprime!')
        fetchIngredients()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleToggleActive = async (ingredient) => {
    try {
      const response = await fetch('/api/ingredients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ingredient.id, active: !ingredient.active })
      })

      if (response.ok) {
        toast.success(ingredient.active ? 'Ingredient desactive' : 'Ingredient active')
        fetchIngredients()
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const getTagInfo = (tagName) => {
    const tag = dietaryTags.find(t => t.name === tagName)
    return tag ? { emoji: tag.emoji, name: tag.name } : { emoji: '', name: tagName }
  }

  const getCategoryInfo = (categoryName) => {
    const cat = categoryOptions.find(c => c.value === categoryName)
    return cat || { value: categoryName, label: categoryName, emoji: '📦' }
  }

  const filteredIngredients = ingredients.filter(ing => {
    const matchesCategory = filter === 'all' || ing.category === filter
    const matchesSearch = !searchQuery ||
      ing.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  if (status === 'loading' || !session) {
    return <div className="text-center py-8">Chargement...</div>
  }

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-200px)]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestion des Ingredients</h1>
        <p className="text-gray-600">Gerez les ingredients et leurs tags alimentaires</p>
      </div>

      <AdminNav />

      {/* Actions */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingIngredient(null)
              setFormData({ name: '', default_unit: 'g', dietary_tags: [], category: 'legume', active: true })
              setShowForm(true)
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold text-sm"
          >
            + Nouvel ingredient
          </button>
        </div>

        {/* Filtres par catégorie */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500">Cat:</span>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${filter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Tous ({ingredients.length})
          </button>
          {categoryOptions.map(cat => {
            const count = ingredients.filter(i => i.category === cat.value).length
            if (count === 0) return null
            return (
              <button
                key={cat.value}
                onClick={() => setFilter(cat.value)}
                className={`px-3 py-1.5 rounded-lg font-semibold text-sm flex items-center gap-1 ${filter === cat.value ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                <span>{cat.emoji}</span>
                <span className="hidden sm:inline">{cat.label}</span>
                <span>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Barre de recherche */}
        <input
          type="text"
          placeholder="Rechercher un ingredient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
        />
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingIngredient ? 'Modifier l\'ingredient' : 'Nouvel ingredient'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unite par defaut
                </label>
                <select
                  value={formData.default_unit}
                  onChange={(e) => setFormData({ ...formData, default_unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  {unitOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categorie
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  {categoryOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags alimentaires (pour filtrage clients)
              </label>
              <div className="flex flex-wrap gap-2">
                {dietaryTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      formData.dietary_tags?.includes(tag.name)
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={tag.description}
                  >
                    <span>{tag.emoji}</span>
                    <span>{tag.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Selectionnez les tags qui s'appliquent a cet ingredient (ex: "porc" pour les lardons)
              </p>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Actif</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
              >
                {editingIngredient ? 'Modifier' : 'Creer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingIngredient(null)
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des ingrédients */}
      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : filteredIngredients.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Aucun ingredient trouve
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Categorie</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Unite</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tags</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredIngredients.map(ingredient => {
                let tags = ingredient.dietary_tags || []
                if (typeof tags === 'string') tags = JSON.parse(tags)
                const catInfo = getCategoryInfo(ingredient.category)

                return (
                  <tr key={ingredient.id} className={`hover:bg-gray-50 ${!ingredient.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{ingredient.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm">
                        <span>{catInfo.emoji}</span>
                        <span>{catInfo.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {ingredient.default_unit}
                    </td>
                    <td className="px-4 py-3">
                      {tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {tags.map(tagName => {
                            const tagInfo = getTagInfo(tagName)
                            return (
                              <span
                                key={tagName}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
                              >
                                {tagInfo.emoji} {tagInfo.name}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(ingredient)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          ingredient.active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ingredient.active ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(ingredient)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(ingredient.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                        >
                          Suppr.
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

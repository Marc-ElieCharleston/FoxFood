'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AdminNav from '@/components/AdminNav'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDish, setEditingDish] = useState(null)
  const [importing, setImporting] = useState(false)
  const [newIngredient, setNewIngredient] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [importLoading, setImportLoading] = useState(false)

  // States pour les variantes
  const [showVariantsModal, setShowVariantsModal] = useState(false)
  const [selectedDishForVariants, setSelectedDishForVariants] = useState(null)
  const [variants, setVariants] = useState([])
  const [dietaryTags, setDietaryTags] = useState([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [editingVariant, setEditingVariant] = useState(null)
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [newVariantIngredient, setNewVariantIngredient] = useState('')
  const [variantFormData, setVariantFormData] = useState({
    name: '',
    ingredients: [], // Ancien format texte
    tags: [],
    isDefault: false
  })

  // States pour les ingrédients liés
  const [allIngredients, setAllIngredients] = useState([])
  const [variantLinkedIngredients, setVariantLinkedIngredients] = useState([])

  // State pour la modal des ingrédients d'un plat
  const [showIngredientsModal, setShowIngredientsModal] = useState(false)
  const [selectedDishIngredients, setSelectedDishIngredients] = useState(null)
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [showIngredientSearch, setShowIngredientSearch] = useState(false)
  const [newIngredientQty, setNewIngredientQty] = useState(100)
  const [newIngredientUnit, setNewIngredientUnit] = useState('g')

  // States pour ajout direct d'ingrédients dans la modal
  const [modalIngredientSearch, setModalIngredientSearch] = useState('')
  const [modalShowSearch, setModalShowSearch] = useState(false)
  const [modalNewQty, setModalNewQty] = useState(100)
  const [modalNewUnit, setModalNewUnit] = useState('g')
  const [addingIngredient, setAddingIngredient] = useState(false)
  const [showCreateIngredient, setShowCreateIngredient] = useState(false)
  const [newIngredientName, setNewIngredientName] = useState('')
  const [newIngredientCategory, setNewIngredientCategory] = useState('legume')

  const [formData, setFormData] = useState({
    name: '',
    category: 'viandes',
    description: '',
    seasons: ['toutes'],
    ingredients: [],
    active: true,
    kids_food: false
  })

  // Fonctions pour gérer les ingrédients
  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      setFormData(prev => ({
        ...prev,
        ingredients: [...(prev.ingredients || []), newIngredient.trim()]
      }))
      setNewIngredient('')
    }
  }

  const handleRemoveIngredient = (index) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }))
  }

  const seasonOptions = [
    { value: 'toutes', label: 'Toute l\'annee', emoji: '📅' },
    { value: 'printemps', label: 'Printemps', emoji: '🌸' },
    { value: 'ete', label: 'Ete', emoji: '☀️' },
    { value: 'automne', label: 'Automne', emoji: '🍂' },
    { value: 'hiver', label: 'Hiver', emoji: '❄️' }
  ]

  // Fonction pour obtenir le nombre d'ingrédients d'un plat
  const getIngredientsCount = (ingredients) => {
    if (!ingredients) return 0
    let ingredientArray = ingredients
    if (typeof ingredients === 'string') {
      try {
        ingredientArray = JSON.parse(ingredients)
      } catch {
        return 0
      }
    }
    if (!Array.isArray(ingredientArray)) return 0
    return ingredientArray.length
  }

  // Fonction pour obtenir les emojis des saisons d'un plat
  const getSeasonEmojis = (seasons) => {
    if (!seasons) return '📅'
    let seasonArray = seasons
    if (typeof seasons === 'string') {
      try {
        seasonArray = JSON.parse(seasons)
      } catch {
        return '📅'
      }
    }
    if (!Array.isArray(seasonArray) || seasonArray.length === 0) return '📅'
    return seasonArray.map(s => {
      const option = seasonOptions.find(o => o.value === s)
      return option ? option.emoji : ''
    }).join('')
  }

  const toggleSeason = (season) => {
    setFormData(prev => {
      let newSeasons = [...(prev.seasons || [])]

      if (season === 'toutes') {
        // Si on clique sur "toutes", on desactive les autres
        return { ...prev, seasons: ['toutes'] }
      } else {
        // Retirer "toutes" si on selectionne une saison specifique
        newSeasons = newSeasons.filter(s => s !== 'toutes')

        if (newSeasons.includes(season)) {
          newSeasons = newSeasons.filter(s => s !== season)
        } else {
          newSeasons.push(season)
        }

        // Si aucune saison, remettre "toutes"
        if (newSeasons.length === 0) {
          newSeasons = ['toutes']
        }
      }

      return { ...prev, seasons: newSeasons }
    })
  }

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
    fetchDietaryTags()
    fetchAllIngredients()
  }, [])

  // Charger tous les ingrédients pour la recherche
  const fetchAllIngredients = async () => {
    try {
      const response = await fetch('/api/ingredients?active=true')
      const data = await response.json()
      setAllIngredients(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erreur chargement ingredients:', error)
    }
  }

  // Charger les tags alimentaires
  const fetchDietaryTags = async () => {
    try {
      const response = await fetch('/api/tags')
      const data = await response.json()
      setDietaryTags(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erreur lors du chargement des tags:', error)
    }
  }

  // Ouvrir la modal des ingrédients d'un plat
  const openIngredientsModal = async (dish) => {
    setSelectedDishIngredients({ ...dish, loadingIngredients: true, variantIngredients: [] })
    setShowIngredientsModal(true)

    try {
      // Récupérer les variantes du plat avec leurs ingrédients
      const response = await fetch(`/api/variants?dishId=${dish.id}`)
      const variantsData = await response.json()

      // Pour chaque variante, récupérer les ingrédients liés
      const variantsWithIngredients = await Promise.all(
        (Array.isArray(variantsData) ? variantsData : []).map(async (variant) => {
          try {
            const ingResponse = await fetch(`/api/variant-ingredients?variantId=${variant.id}`)
            const ingData = await ingResponse.json()
            return { ...variant, linkedIngredients: Array.isArray(ingData) ? ingData : [] }
          } catch {
            return { ...variant, linkedIngredients: [] }
          }
        })
      )

      setSelectedDishIngredients(prev => ({
        ...prev,
        loadingIngredients: false,
        variantIngredients: variantsWithIngredients
      }))
    } catch (error) {
      console.error('Erreur:', error)
      setSelectedDishIngredients(prev => ({ ...prev, loadingIngredients: false }))
    }
  }

  // Ouvrir la modal des variantes
  const openVariantsModal = async (dish) => {
    setSelectedDishForVariants(dish)
    setShowVariantsModal(true)
    setLoadingVariants(true)
    try {
      const response = await fetch(`/api/variants?dishId=${dish.id}`)
      const data = await response.json()
      // Pour chaque variante, charger les ingrédients liés
      const variantsWithIngredients = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (variant) => {
          try {
            const ingResponse = await fetch(`/api/variant-ingredients?variantId=${variant.id}`)
            const ingData = await ingResponse.json()
            return { ...variant, linkedIngredients: Array.isArray(ingData) ? ingData : [] }
          } catch {
            return { ...variant, linkedIngredients: [] }
          }
        })
      )
      setVariants(variantsWithIngredients)
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors du chargement des variantes')
    } finally {
      setLoadingVariants(false)
    }
  }

  // Fermer la modal des variantes
  const closeVariantsModal = () => {
    setShowVariantsModal(false)
    setSelectedDishForVariants(null)
    setVariants([])
    setEditingVariant(null)
    setShowVariantForm(false)
    setVariantFormData({ name: '', ingredients: [], tags: [], isDefault: false })
    setNewVariantIngredient('')
    setVariantLinkedIngredients([])
    setIngredientSearch('')
    setShowIngredientSearch(false)
  }

  // Ouvrir le formulaire d'ajout de variante
  const openAddVariantForm = (copyFrom = null) => {
    setEditingVariant(null)
    setVariantLinkedIngredients([])
    setIngredientSearch('')
    if (copyFrom) {
      // Copier les ingredients et tags d'une variante existante
      const variantToCopy = variants.find(v => v.id === copyFrom)
      if (variantToCopy) {
        let ingredients = variantToCopy.ingredients || []
        let tags = variantToCopy.tags || []
        if (typeof ingredients === 'string') ingredients = JSON.parse(ingredients)
        if (typeof tags === 'string') tags = JSON.parse(tags)
        setVariantFormData({
          name: '',
          ingredients: [...ingredients],
          tags: [...tags],
          isDefault: false
        })
        // Copier aussi les ingrédients liés
        if (variantToCopy.linkedIngredients) {
          setVariantLinkedIngredients(variantToCopy.linkedIngredients.map(li => ({
            ...li,
            id: null, // Pas encore sauvegardé
            isNew: true
          })))
        }
      }
    } else {
      setVariantFormData({ name: '', ingredients: [], tags: [], isDefault: false })
    }
    setShowVariantForm(true)
  }

  // Ouvrir le formulaire d'edition de variante
  const openEditVariantForm = (variant) => {
    setEditingVariant(variant)
    let ingredients = variant.ingredients || []
    let tags = variant.tags || []
    if (typeof ingredients === 'string') ingredients = JSON.parse(ingredients)
    if (typeof tags === 'string') tags = JSON.parse(tags)
    setVariantFormData({
      name: variant.name,
      ingredients: ingredients,
      tags: tags,
      isDefault: variant.is_default
    })
    // Charger les ingrédients liés
    setVariantLinkedIngredients(variant.linkedIngredients || [])
    setIngredientSearch('')
    setShowVariantForm(true)
  }

  // Ajouter un ingrédient lié à la variante
  const handleAddLinkedIngredient = (ingredient) => {
    // Vérifier si déjà ajouté
    if (variantLinkedIngredients.some(li => li.ingredient_id === ingredient.id)) {
      toast.error('Cet ingredient est deja ajoute')
      return
    }
    setVariantLinkedIngredients(prev => [...prev, {
      id: null,
      isNew: true,
      ingredient_id: ingredient.id,
      ingredient_name: ingredient.name,
      ingredient_tags: ingredient.dietary_tags,
      ingredient_category: ingredient.category,
      quantity: newIngredientQty,
      unit: newIngredientUnit || ingredient.default_unit,
      default_unit: ingredient.default_unit
    }])
    setIngredientSearch('')
    setShowIngredientSearch(false)
    setNewIngredientQty(100)
    setNewIngredientUnit('g')
  }

  // Supprimer un ingrédient lié
  const handleRemoveLinkedIngredient = (index) => {
    setVariantLinkedIngredients(prev => prev.filter((_, i) => i !== index))
  }

  // Modifier la quantité d'un ingrédient lié
  const handleUpdateLinkedIngredientQty = (index, qty) => {
    setVariantLinkedIngredients(prev => prev.map((li, i) =>
      i === index ? { ...li, quantity: parseFloat(qty) || 0 } : li
    ))
  }

  // Calculer les tags automatiques basés sur les ingrédients
  const getAutoTags = () => {
    const autoTags = new Set()
    variantLinkedIngredients.forEach(li => {
      let tags = li.ingredient_tags || []
      if (typeof tags === 'string') tags = JSON.parse(tags)
      tags.forEach(t => autoTags.add(t))
    })
    return Array.from(autoTags)
  }

  // Filtrer les ingrédients pour la recherche
  const filteredIngredientsForSearch = allIngredients.filter(ing =>
    ing.name.toLowerCase().includes(ingredientSearch.toLowerCase()) &&
    !variantLinkedIngredients.some(li => li.ingredient_id === ing.id)
  ).slice(0, 10)

  // Filtrer les ingrédients pour la recherche dans la modal
  const filteredModalIngredients = allIngredients.filter(ing => {
    if (!modalIngredientSearch) return false
    const matchesSearch = ing.name.toLowerCase().includes(modalIngredientSearch.toLowerCase())
    // Exclure les ingrédients déjà liés à la variante par défaut
    const defaultVariant = selectedDishIngredients?.variantIngredients?.find(v => v.is_default)
    const alreadyLinked = defaultVariant?.linkedIngredients?.some(li => li.ingredient_id === ing.id)
    return matchesSearch && !alreadyLinked
  }).slice(0, 8)

  // Ajouter un ingrédient directement depuis la modal (à la variante par défaut)
  const handleAddIngredientFromModal = async (ingredient) => {
    if (addingIngredient) return
    setAddingIngredient(true)

    try {
      // Trouver la variante par défaut du plat
      let defaultVariant = selectedDishIngredients?.variantIngredients?.find(v => v.is_default)

      // Si pas de variante par défaut, en créer une
      if (!defaultVariant) {
        const createResponse = await fetch('/api/variants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dishId: selectedDishIngredients.id,
            name: 'Classique',
            ingredients: [],
            tags: [],
            isDefault: true
          })
        })
        if (!createResponse.ok) throw new Error('Erreur création variante')
        defaultVariant = await createResponse.json()
      }

      // Ajouter l'ingrédient à la variante
      const response = await fetch('/api/variant-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: defaultVariant.id,
          ingredientId: ingredient.id,
          quantity: modalNewQty,
          unit: modalNewUnit || ingredient.default_unit
        })
      })

      if (response.ok) {
        toast.success(`${ingredient.name} ajouté!`)
        // Rafraîchir les données
        await refreshIngredientsModal()
        setModalIngredientSearch('')
        setModalShowSearch(false)
        setModalNewQty(100)
        setModalNewUnit('g')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de l\'ajout')
    } finally {
      setAddingIngredient(false)
    }
  }

  // Créer un nouvel ingrédient et l'ajouter
  const handleCreateAndAddIngredient = async () => {
    if (!newIngredientName.trim()) {
      toast.error('Nom requis')
      return
    }
    setAddingIngredient(true)

    try {
      // Créer l'ingrédient
      const createResponse = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newIngredientName.trim(),
          default_unit: modalNewUnit,
          category: newIngredientCategory,
          dietary_tags: []
        })
      })

      if (!createResponse.ok) {
        const data = await createResponse.json()
        toast.error(data.error || 'Erreur création')
        return
      }

      const newIngredient = await createResponse.json()
      toast.success(`Ingrédient "${newIngredient.name}" créé!`)

      // Rafraîchir la liste des ingrédients
      await fetchAllIngredients()

      // Ajouter au plat
      await handleAddIngredientFromModal(newIngredient)

      // Reset
      setShowCreateIngredient(false)
      setNewIngredientName('')
      setNewIngredientCategory('legume')
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la création')
    } finally {
      setAddingIngredient(false)
    }
  }

  // Rafraîchir les données de la modal ingrédients
  const refreshIngredientsModal = async () => {
    if (!selectedDishIngredients) return
    try {
      const response = await fetch(`/api/variants?dishId=${selectedDishIngredients.id}`)
      const variantsData = await response.json()

      const variantsWithIngredients = await Promise.all(
        (Array.isArray(variantsData) ? variantsData : []).map(async (variant) => {
          try {
            const ingResponse = await fetch(`/api/variant-ingredients?variantId=${variant.id}`)
            const ingData = await ingResponse.json()
            return { ...variant, linkedIngredients: Array.isArray(ingData) ? ingData : [] }
          } catch {
            return { ...variant, linkedIngredients: [] }
          }
        })
      )

      setSelectedDishIngredients(prev => ({
        ...prev,
        variantIngredients: variantsWithIngredients
      }))
    } catch (error) {
      console.error('Erreur refresh:', error)
    }
  }

  // Supprimer un ingrédient depuis la modal
  const handleRemoveIngredientFromModal = async (ingredientLinkId) => {
    try {
      const response = await fetch(`/api/variant-ingredients?id=${ingredientLinkId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        toast.success('Ingrédient retiré')
        await refreshIngredientsModal()
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  // Ajouter un ingredient a la variante
  const handleAddVariantIngredient = () => {
    if (newVariantIngredient.trim()) {
      setVariantFormData(prev => ({
        ...prev,
        ingredients: [...prev.ingredients, newVariantIngredient.trim()]
      }))
      setNewVariantIngredient('')
    }
  }

  // Supprimer un ingredient de la variante
  const handleRemoveVariantIngredient = (index) => {
    setVariantFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }))
  }

  // Toggle un tag sur la variante
  const toggleVariantTag = (tagName) => {
    setVariantFormData(prev => {
      const tags = prev.tags || []
      if (tags.includes(tagName)) {
        return { ...prev, tags: tags.filter(t => t !== tagName) }
      } else {
        return { ...prev, tags: [...tags, tagName] }
      }
    })
  }

  // Sauvegarder une variante
  const handleSaveVariant = async () => {
    if (!variantFormData.name.trim()) {
      toast.error('Le nom de la variante est requis')
      return
    }

    try {
      const url = '/api/variants'
      const method = editingVariant ? 'PUT' : 'POST'

      // Combiner les tags manuels et automatiques
      const autoTags = getAutoTags()
      const allTags = [...new Set([...variantFormData.tags, ...autoTags])]

      const body = editingVariant
        ? {
            id: editingVariant.id,
            name: variantFormData.name,
            ingredients: variantFormData.ingredients,
            tags: allTags,
            isDefault: variantFormData.isDefault
          }
        : {
            dishId: selectedDishForVariants.id,
            name: variantFormData.name,
            ingredients: variantFormData.ingredients,
            tags: allTags,
            isDefault: variantFormData.isDefault
          }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const savedVariant = await response.json()
        const variantId = savedVariant.id

        // Sauvegarder les ingrédients liés
        // D'abord, supprimer les anciens si on édite
        if (editingVariant) {
          const existingIds = (editingVariant.linkedIngredients || []).map(li => li.id)
          const currentIds = variantLinkedIngredients.filter(li => li.id).map(li => li.id)
          // Supprimer ceux qui ne sont plus présents
          for (const oldId of existingIds) {
            if (!currentIds.includes(oldId)) {
              await fetch(`/api/variant-ingredients?id=${oldId}`, { method: 'DELETE' })
            }
          }
        }

        // Ajouter ou mettre à jour les ingrédients liés
        for (const li of variantLinkedIngredients) {
          if (li.id && !li.isNew) {
            // Mettre à jour
            await fetch('/api/variant-ingredients', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: li.id,
                quantity: li.quantity,
                unit: li.unit
              })
            })
          } else {
            // Ajouter
            await fetch('/api/variant-ingredients', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                variantId: variantId,
                ingredientId: li.ingredient_id,
                quantity: li.quantity,
                unit: li.unit
              })
            })
          }
        }

        toast.success(editingVariant ? 'Variante modifiee!' : 'Variante creee!')

        // Recharger les variantes avec ingrédients
        const variantsResponse = await fetch(`/api/variants?dishId=${selectedDishForVariants.id}`)
        const variantsData = await variantsResponse.json()
        const variantsWithIngredients = await Promise.all(
          (Array.isArray(variantsData) ? variantsData : []).map(async (variant) => {
            try {
              const ingResponse = await fetch(`/api/variant-ingredients?variantId=${variant.id}`)
              const ingData = await ingResponse.json()
              return { ...variant, linkedIngredients: Array.isArray(ingData) ? ingData : [] }
            } catch {
              return { ...variant, linkedIngredients: [] }
            }
          })
        )
        setVariants(variantsWithIngredients)

        setShowVariantForm(false)
        setEditingVariant(null)
        setVariantFormData({ name: '', ingredients: [], tags: [], isDefault: false })
        setVariantLinkedIngredients([])
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  // Supprimer une variante
  const handleDeleteVariant = async (variantId) => {
    if (!confirm('Supprimer cette variante?')) return

    try {
      const response = await fetch(`/api/variants?id=${variantId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Variante supprimee!')
        setVariants(prev => prev.filter(v => v.id !== variantId))
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  // Obtenir l'emoji et le nom d'un tag
  const getTagInfo = (tagName) => {
    const tag = dietaryTags.find(t => t.name === tagName)
    return tag ? { emoji: tag.emoji, name: tag.name, description: tag.description } : { emoji: '', name: tagName, description: '' }
  }

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

  // Télécharger le template Excel
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/import-dishes')
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'foxfood-template-plats.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Template téléchargé!')
      } else {
        toast.error('Erreur lors du téléchargement')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors du téléchargement')
    }
  }

  // Importer depuis Excel
  const handleExcelImport = async () => {
    if (!importFile) {
      toast.error('Sélectionnez un fichier')
      return
    }

    try {
      setImportLoading(true)
      const formData = new FormData()
      formData.append('file', importFile)

      const response = await fetch('/api/admin/import-dishes', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setImportResult(data)
        if (data.summary.inserted > 0) {
          toast.success(`${data.summary.inserted} plat(s) importé(s)!`)
          fetchDishes()
        }
      } else {
        setImportResult({ error: data.error, details: data.details })
        toast.error(data.error || 'Erreur lors de l\'import')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de l\'import')
    } finally {
      setImportLoading(false)
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
        setFormData({ name: '', category: 'viandes', description: '', seasons: ['toutes'], ingredients: [], active: true })
        setNewIngredient('')
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
    // Gérer les saisons stockées en JSONB (peut être string ou array)
    let dishSeasons = ['toutes']
    if (dish.seasons) {
      if (typeof dish.seasons === 'string') {
        try {
          dishSeasons = JSON.parse(dish.seasons)
        } catch {
          dishSeasons = ['toutes']
        }
      } else if (Array.isArray(dish.seasons)) {
        dishSeasons = dish.seasons
      }
    }
    // Gérer les ingrédients stockés en JSONB
    let dishIngredients = []
    if (dish.ingredients) {
      if (typeof dish.ingredients === 'string') {
        try {
          dishIngredients = JSON.parse(dish.ingredients)
        } catch {
          dishIngredients = []
        }
      } else if (Array.isArray(dish.ingredients)) {
        dishIngredients = dish.ingredients
      }
    }
    setFormData({
      name: dish.name,
      category: dish.category,
      description: dish.description || '',
      seasons: dishSeasons,
      ingredients: dishIngredients,
      active: dish.active,
      kids_food: dish.kids_food || false
    })
    setNewIngredient('')
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

    // Filtre par saison
    let matchesSeason = seasonFilter === 'all'
    if (!matchesSeason) {
      let dishSeasons = dish.seasons
      if (typeof dishSeasons === 'string') {
        try {
          dishSeasons = JSON.parse(dishSeasons)
        } catch {
          dishSeasons = ['toutes']
        }
      }
      if (!Array.isArray(dishSeasons)) dishSeasons = ['toutes']
      matchesSeason = dishSeasons.includes('toutes') || dishSeasons.includes(seasonFilter)
    }

    // Filtre par recherche
    const matchesSearch = !searchQuery ||
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dish.description && dish.description.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesCategory && matchesSeason && matchesSearch
  })

  const categoryLabels = {
    viandes: 'Viandes',
    poissons: 'Poissons',
    vegetation: 'Végétarien',
    desserts: 'Desserts'
  }

  if (status === 'loading' || !session) {
    return <div className="text-center py-8">Chargement...</div>
  }

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-200px)]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Administration FoxFood</h1>
        <p className="text-gray-600">Gestion des plats du catalogue</p>
      </div>

      <AdminNav />

      {/* Actions */}
      <div className="mb-6 space-y-3">
        {/* Boutons d'action principaux */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingDish(null)
              setFormData({ name: '', category: 'viandes', description: '', seasons: ['toutes'], ingredients: [], active: true, kids_food: false })
              setNewIngredient('')
              setShowForm(true)
            }}
            className="px-3 py-2 md:px-4 md:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold text-sm"
          >
            <span className="hidden sm:inline">➕ Nouveau plat</span>
            <span className="sm:hidden">➕ Nouveau</span>
          </button>

          <button
            onClick={() => {
              setShowImportModal(true)
              setImportFile(null)
              setImportResult(null)
            }}
            className="px-3 py-2 md:px-4 md:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm"
          >
            📊 Import Excel
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
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500">Cat:</span>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${filter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            <span className="hidden sm:inline">Tous ({dishes.length})</span>
            <span className="sm:hidden">Tous {dishes.length}</span>
          </button>
          {['viandes', 'poissons', 'vegetation', 'desserts'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${filter === cat ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              {/* Tablette/Desktop: texte complet */}
              <span className="hidden sm:inline">{categoryLabels[cat]} ({dishes.filter(d => d.category === cat).length})</span>
              {/* Mobile: première lettre + nombre */}
              <span className="sm:hidden">{categoryLabels[cat][0]} {dishes.filter(d => d.category === cat).length}</span>
            </button>
          ))}
        </div>

        {/* Filtres de saison */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500">Saison:</span>
          <button
            onClick={() => setSeasonFilter('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
              seasonFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Toutes
          </button>
          {seasonOptions.filter(s => s.value !== 'toutes').map(season => (
            <button
              key={season.value}
              onClick={() => setSeasonFilter(season.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                seasonFilter === season.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{season.emoji}</span>
              <span className="hidden sm:inline">{season.label}</span>
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="viandes">Viandes</option>
                  <option value="poissons">Poissons</option>
                  <option value="vegetation">Végétarien</option>
                  <option value="desserts">Desserts</option>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                rows={3}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Saisons
              </label>
              <div className="flex flex-wrap gap-2">
                {seasonOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleSeason(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                      formData.seasons?.includes(option.value)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{option.emoji}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Selectionnez les saisons ou le plat est disponible
              </p>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.kids_food || false}
                  onChange={(e) => setFormData({ ...formData, kids_food: e.target.checked })}
                  className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                />
                <span className="text-sm font-medium text-gray-700">👶 Kids Food</span>
                <span className="text-xs text-gray-500">(plat adapté aux enfants)</span>
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ingredients
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
                  placeholder="Ajouter un ingredient..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm"
                >
                  Ajouter
                </button>
              </div>
              {formData.ingredients && formData.ingredients.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.ingredients.map((ingredient, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {ingredient}
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(index)}
                        className="text-gray-500 hover:text-red-600 ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Appuyez sur Entree ou cliquez Ajouter pour chaque ingredient
              </p>
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
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
              >
                {editingDish ? 'Modifier' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingDish(null)
                  setFormData({ name: '', category: 'viandes', description: '', seasons: ['toutes'], ingredients: [], active: true, kids_food: false })
                  setNewIngredient('')
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
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        dish.category === 'viandes' ? 'bg-red-100 text-red-800' :
                        dish.category === 'poissons' ? 'bg-blue-100 text-blue-800' :
                        dish.category === 'desserts' ? 'bg-amber-100 text-amber-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {categoryLabels[dish.category]}
                      </span>
                      {dish.kids_food && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-pink-100 text-pink-700" title="Kids Food">
                          👶
                        </span>
                      )}
                      <span className="text-sm" title="Saisons">
                        {getSeasonEmojis(dish.seasons)}
                      </span>
                      {getIngredientsCount(dish.ingredients) > 0 && (
                        <span className="text-xs text-gray-500" title="Ingredients">
                          🥕 {getIngredientsCount(dish.ingredients)}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {dish.active ? '✅' : '❌'}
                      </span>
                    </div>
                    {dish.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">{dish.description}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => openIngredientsModal(dish)}
                    className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 font-semibold"
                  >
                    🥕 Ingrédients
                  </button>
                  <button
                    onClick={() => openVariantsModal(dish)}
                    className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 font-semibold"
                  >
                    🏷️ Variantes
                  </button>
                  <button
                    onClick={() => handleEdit(dish)}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(dish.id)}
                    className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-semibold"
                  >
                    🗑️ Suppr.
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Vue desktop - Table améliorée */}
          <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200">
                  <th className="w-[22%] px-4 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Nom du plat
                  </th>
                  <th className="w-[9%] px-3 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Cat.
                  </th>
                  <th className="w-[7%] px-2 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Saisons
                  </th>
                  <th className="w-[5%] px-2 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Ing.
                  </th>
                  <th className="w-[30%] px-3 py-3 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="w-[10%] px-2 py-3 text-center text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="w-[17%] px-3 py-3 text-right text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDishes.map((dish, index) => (
                  <tr
                    key={dish.id}
                    className={`${!dish.active ? 'opacity-40' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-primary-50 transition-colors`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${dish.active ? 'bg-success-500' : 'bg-gray-300'}`}></div>
                        <span className="text-sm font-medium text-gray-900 line-clamp-2" title={dish.name}>{dish.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        dish.category === 'viandes' ? 'bg-red-100 text-red-700' :
                        dish.category === 'poissons' ? 'bg-blue-100 text-blue-700' :
                        dish.category === 'desserts' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {categoryLabels[dish.category]}
                      </span>
                      {dish.kids_food && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700" title="Kids Food">
                          👶
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="text-base" title="Saisons disponibles">
                        {getSeasonEmojis(dish.seasons)}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => openIngredientsModal(dish)}
                        className="p-1.5 text-amber-600 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors"
                        title="Voir les ingrédients"
                      >
                        🔍
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-gray-600 line-clamp-2" title={dish.description || ''}>
                        {dish.description || <span className="text-gray-400 italic">-</span>}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        dish.active
                          ? 'bg-success-100 text-success-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {dish.active ? '✓ Actif' : '○ Inactif'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openVariantsModal(dish)}
                          className="px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors"
                          title="Gérer les variantes"
                        >
                          🏷️
                        </button>
                        <button
                          onClick={() => handleEdit(dish)}
                          className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                          title="Modifier"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(dish.id)}
                          className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal de gestion des variantes */}
      {showVariantsModal && selectedDishForVariants && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Variantes de "{selectedDishForVariants.name}"</h2>
                <p className="text-sm text-gray-500">Gerez les declinaisons de ce plat (halal, vegetarien, etc.)</p>
              </div>
              <button
                onClick={closeVariantsModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {loadingVariants ? (
                <div className="text-center py-8">Chargement des variantes...</div>
              ) : (
                <>
                  {/* Liste des variantes */}
                  {!showVariantForm && (
                    <>
                      <div className="space-y-3 mb-6">
                        {variants.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">Aucune variante pour ce plat</p>
                        ) : (
                          variants.map(variant => {
                            let ingredients = variant.ingredients || []
                            let tags = variant.tags || []
                            if (typeof ingredients === 'string') ingredients = JSON.parse(ingredients)
                            if (typeof tags === 'string') tags = JSON.parse(tags)

                            return (
                              <div
                                key={variant.id}
                                className={`border rounded-lg p-4 ${variant.is_default ? 'border-purple-300 bg-purple-50' : 'border-gray-200'}`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">{variant.name}</h3>
                                    {variant.is_default && (
                                      <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                                        Par defaut
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => openAddVariantForm(variant.id)}
                                      className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                      title="Dupliquer cette variante"
                                    >
                                      📋 Copier
                                    </button>
                                    <button
                                      onClick={() => openEditVariantForm(variant)}
                                      className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                                    >
                                      ✏️ Modifier
                                    </button>
                                    <button
                                      onClick={() => handleDeleteVariant(variant.id)}
                                      className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>

                                {/* Tags */}
                                {tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {tags.map(tagName => {
                                      const tagInfo = getTagInfo(tagName)
                                      return (
                                        <span
                                          key={tagName}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs"
                                          title={tagInfo.description}
                                        >
                                          {tagInfo.emoji} {tagInfo.name}
                                        </span>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* Ingredients lies */}
                                {variant.linkedIngredients && variant.linkedIngredients.length > 0 && (
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium">Ingredients:</span>{' '}
                                    {variant.linkedIngredients.map(li =>
                                      `${li.ingredient_name} (${li.quantity}${li.unit})`
                                    ).join(', ')}
                                  </div>
                                )}
                                {/* Ancien format ingredients texte */}
                                {(!variant.linkedIngredients || variant.linkedIngredients.length === 0) && ingredients.length > 0 && (
                                  <div className="text-sm text-gray-500 italic">
                                    <span className="font-medium">Notes:</span>{' '}
                                    {ingredients.join(', ')}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>

                      <button
                        onClick={() => openAddVariantForm()}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                      >
                        ➕ Ajouter une variante
                      </button>
                    </>
                  )}

                  {/* Formulaire d'ajout/edition de variante */}
                  {showVariantForm && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg">
                          {editingVariant ? 'Modifier la variante' : 'Nouvelle variante'}
                        </h3>
                        <button
                          onClick={() => {
                            setShowVariantForm(false)
                            setEditingVariant(null)
                            setVariantFormData({ name: '', ingredients: [], tags: [], isDefault: false })
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ← Retour
                        </button>
                      </div>

                      {/* Nom de la variante */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nom de la variante *
                        </label>
                        <input
                          type="text"
                          value={variantFormData.name}
                          onChange={(e) => setVariantFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Halal, Vegetarien, Sans gluten..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* Tags alimentaires */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tags alimentaires
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {dietaryTags.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleVariantTag(tag.name)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                                variantFormData.tags?.includes(tag.name)
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              title={tag.description}
                            >
                              <span>{tag.emoji}</span>
                              <span>{tag.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Ingredients lies avec quantites */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Ingredients (avec quantites)
                        </label>

                        {/* Recherche d'ingredients */}
                        <div className="relative mb-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={ingredientSearch}
                              onChange={(e) => {
                                setIngredientSearch(e.target.value)
                                setShowIngredientSearch(e.target.value.length > 0)
                              }}
                              onFocus={() => setShowIngredientSearch(ingredientSearch.length > 0)}
                              placeholder="Rechercher un ingredient..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                            />
                            <input
                              type="number"
                              value={newIngredientQty}
                              onChange={(e) => setNewIngredientQty(parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="Qte"
                            />
                            <select
                              value={newIngredientUnit}
                              onChange={(e) => setNewIngredientUnit(e.target.value)}
                              className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="ml">ml</option>
                              <option value="L">L</option>
                              <option value="pc">pc</option>
                              <option value="c.a.s">c.a.s</option>
                              <option value="qsp">qsp</option>
                            </select>
                          </div>

                          {/* Liste de recherche */}
                          {showIngredientSearch && filteredIngredientsForSearch.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {filteredIngredientsForSearch.map(ing => {
                                let tags = ing.dietary_tags || []
                                if (typeof tags === 'string') tags = JSON.parse(tags)
                                return (
                                  <button
                                    key={ing.id}
                                    type="button"
                                    onClick={() => handleAddLinkedIngredient(ing)}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between text-sm"
                                  >
                                    <span>{ing.name}</span>
                                    <span className="text-xs text-gray-400">
                                      {ing.category} {tags.length > 0 && `• ${tags.join(', ')}`}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Liste des ingredients lies */}
                        {variantLinkedIngredients.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {variantLinkedIngredients.map((li, index) => {
                              let tags = li.ingredient_tags || []
                              if (typeof tags === 'string') tags = JSON.parse(tags)
                              return (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                                >
                                  <span className="flex-1 text-sm font-medium">{li.ingredient_name}</span>
                                  {tags.length > 0 && (
                                    <div className="flex gap-1">
                                      {tags.map(t => {
                                        const tagInfo = getTagInfo(t)
                                        return (
                                          <span key={t} className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                            {tagInfo.emoji}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                  <input
                                    type="number"
                                    value={li.quantity}
                                    onChange={(e) => handleUpdateLinkedIngredientQty(index, e.target.value)}
                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                                  />
                                  <span className="text-xs text-gray-500 w-8">{li.unit}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLinkedIngredient(index)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Tags automatiques */}
                        {getAutoTags().length > 0 && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                            <p className="text-xs text-amber-800 mb-1 font-medium">Tags automatiques (basés sur les ingrédients) :</p>
                            <div className="flex flex-wrap gap-1">
                              {getAutoTags().map(tagName => {
                                const tagInfo = getTagInfo(tagName)
                                return (
                                  <span
                                    key={tagName}
                                    className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs"
                                  >
                                    {tagInfo.emoji} {tagInfo.name}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-gray-500">
                          Recherchez et ajoutez des ingredients. Les tags seront calcules automatiquement.
                        </p>
                      </div>

                      {/* Variante par defaut */}
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={variantFormData.isDefault}
                            onChange={(e) => setVariantFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                            className="w-4 h-4 text-purple-600 rounded"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Variante par defaut
                          </span>
                        </label>
                        <p className="text-xs text-gray-500 ml-6">
                          La variante par defaut sera selectionnee automatiquement pour les clients
                        </p>
                      </div>

                      {/* Boutons d'action */}
                      <div className="flex gap-2 pt-4">
                        <button
                          onClick={handleSaveVariant}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                        >
                          {editingVariant ? 'Modifier' : 'Creer la variante'}
                        </button>
                        <button
                          onClick={() => {
                            setShowVariantForm(false)
                            setEditingVariant(null)
                            setVariantFormData({ name: '', ingredients: [], tags: [], isDefault: false })
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Excel */}
      {showImportModal && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">📊 Import Excel</h2>
                <p className="text-sm text-gray-500">Importez plusieurs plats depuis un fichier Excel</p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">Format attendu :</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Nom</strong> : Nom du plat (obligatoire)</li>
                  <li>• <strong>Catégorie</strong> : viandes, poissons ou vegetation</li>
                  <li>• <strong>Description</strong> : Description du plat</li>
                  <li>• <strong>Saisons</strong> : printemps, ete, automne, hiver, toutes</li>
                  <li>• <strong>Ingrédients</strong> : format <code className="bg-blue-100 px-1 rounded">quantité+unité:nom</code></li>
                </ul>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-600 font-medium mb-1">Exemple d'ingrédients :</p>
                  <code className="text-xs text-blue-800 bg-blue-100 px-2 py-1 rounded block">
                    200g:poulet, 100g:riz, 2pc:oeufs, 0:sel, 0:poivre
                  </code>
                  <p className="text-xs text-blue-600 mt-2">
                    Unités : g, kg, ml, L, pc (pièce), c.a.s (cuillère)
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    💡 <strong>0:sel</strong> = épice à volonté (non calculée par personne)
                  </p>
                </div>
              </div>

              {/* Télécharger template */}
              <button
                onClick={handleDownloadTemplate}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center justify-center gap-2"
              >
                <span>📥</span>
                <span>Télécharger le template Excel</span>
              </button>

              {/* Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    setImportFile(e.target.files[0])
                    setImportResult(null)
                  }}
                  className="hidden"
                  id="excel-import"
                />
                <label
                  htmlFor="excel-import"
                  className="cursor-pointer"
                >
                  <div className="text-4xl mb-2">📄</div>
                  {importFile ? (
                    <p className="text-green-600 font-medium">{importFile.name}</p>
                  ) : (
                    <p className="text-gray-500">Cliquez pour sélectionner un fichier .xlsx</p>
                  )}
                </label>
              </div>

              {/* Bouton importer */}
              {importFile && !importResult && (
                <button
                  onClick={handleExcelImport}
                  disabled={importLoading}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
                >
                  {importLoading ? 'Import en cours...' : `Importer ${importFile.name}`}
                </button>
              )}

              {/* Résultat de l'import */}
              {importResult && (
                <div className="space-y-3">
                  {importResult.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="font-semibold text-red-700 mb-2">Erreur : {importResult.error}</p>
                      {importResult.details && importResult.details.length > 0 && (
                        <ul className="text-sm text-red-600 space-y-1">
                          {importResult.details.map((err, i) => (
                            <li key={i}>• {err}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="font-semibold text-green-700 mb-2">Import terminé!</p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-green-600">{importResult.summary.inserted}</p>
                          <p className="text-xs text-gray-600">Importés</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-amber-600">{importResult.summary.skipped}</p>
                          <p className="text-xs text-gray-600">Ignorés</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-red-600">{importResult.summary.errors}</p>
                          <p className="text-xs text-gray-600">Erreurs</p>
                        </div>
                      </div>

                      {/* Détails */}
                      {importResult.details.inserted.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <p className="text-xs font-medium text-green-700 mb-1">Plats importés :</p>
                          <p className="text-xs text-green-600">{importResult.details.inserted.join(', ')}</p>
                        </div>
                      )}

                      {importResult.details.skipped.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <p className="text-xs font-medium text-amber-700 mb-1">Ignorés (existent déjà) :</p>
                          <p className="text-xs text-amber-600">{importResult.details.skipped.join(', ')}</p>
                        </div>
                      )}

                      {importResult.details.errors.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <p className="text-xs font-medium text-red-700 mb-1">Erreurs :</p>
                          <ul className="text-xs text-red-600 space-y-0.5">
                            {importResult.details.errors.map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bouton pour réimporter */}
                  <button
                    onClick={() => {
                      setImportFile(null)
                      setImportResult(null)
                    }}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Importer un autre fichier
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal des ingrédients */}
      {showIngredientsModal && selectedDishIngredients && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-lg font-bold">🥕 Ingrédients</h2>
                <p className="text-sm text-gray-600">{selectedDishIngredients.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowIngredientsModal(false)
                  setSelectedDishIngredients(null)
                  setModalIngredientSearch('')
                  setModalShowSearch(false)
                  setShowCreateIngredient(false)
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {selectedDishIngredients.loadingIngredients ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : (
                <div className="space-y-4">
                  {/* Section Ajouter un ingrédient */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-sm text-green-800 mb-3">➕ Ajouter un ingrédient</h3>

                    {!showCreateIngredient ? (
                      <div className="relative">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={modalIngredientSearch}
                            onChange={(e) => {
                              setModalIngredientSearch(e.target.value)
                              setModalShowSearch(e.target.value.length > 0)
                            }}
                            onFocus={() => setModalShowSearch(modalIngredientSearch.length > 0)}
                            placeholder="Rechercher un ingrédient..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                          />
                          <input
                            type="number"
                            value={modalNewQty}
                            onChange={(e) => setModalNewQty(parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center"
                            placeholder="Qte"
                          />
                          <select
                            value={modalNewUnit}
                            onChange={(e) => setModalNewUnit(e.target.value)}
                            className="w-16 px-1 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="L">L</option>
                            <option value="pc">pc</option>
                            <option value="c.a.s">c.a.s</option>
                          </select>
                        </div>

                        {/* Liste de recherche */}
                        {modalShowSearch && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredModalIngredients.length > 0 ? (
                              filteredModalIngredients.map(ing => (
                                <button
                                  key={ing.id}
                                  type="button"
                                  onClick={() => handleAddIngredientFromModal(ing)}
                                  disabled={addingIngredient}
                                  className="w-full px-3 py-2 text-left hover:bg-green-50 flex items-center justify-between text-sm disabled:opacity-50"
                                >
                                  <span>{ing.name}</span>
                                  <span className="text-xs text-gray-400">{ing.category}</span>
                                </button>
                              ))
                            ) : modalIngredientSearch.length > 0 ? (
                              <div className="p-3 text-center">
                                <p className="text-sm text-gray-500 mb-2">Aucun résultat</p>
                                <button
                                  onClick={() => {
                                    setNewIngredientName(modalIngredientSearch)
                                    setShowCreateIngredient(true)
                                    setModalShowSearch(false)
                                  }}
                                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                                >
                                  ➕ Créer "{modalIngredientSearch}"
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Formulaire création ingrédient */
                      <div className="space-y-3 bg-white p-3 rounded-lg border">
                        <p className="text-sm font-medium text-gray-700">Créer un nouvel ingrédient</p>
                        <input
                          type="text"
                          value={newIngredientName}
                          onChange={(e) => setNewIngredientName(e.target.value)}
                          placeholder="Nom de l'ingrédient"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <div className="flex gap-2">
                          <select
                            value={newIngredientCategory}
                            onChange={(e) => setNewIngredientCategory(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="viande">🥩 Viande</option>
                            <option value="poisson">🐟 Poisson</option>
                            <option value="produit_laitier">🥛 Produit laitier</option>
                            <option value="feculent">🍞 Féculent</option>
                            <option value="legume">🥕 Légume</option>
                            <option value="fruit">🍎 Fruit</option>
                            <option value="epice">🌶️ Épice</option>
                            <option value="condiment">🫒 Condiment</option>
                            <option value="autre">📦 Autre</option>
                          </select>
                          <select
                            value={modalNewUnit}
                            onChange={(e) => setModalNewUnit(e.target.value)}
                            className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="pc">pc</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateAndAddIngredient}
                            disabled={addingIngredient}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {addingIngredient ? 'Création...' : 'Créer et ajouter'}
                          </button>
                          <button
                            onClick={() => {
                              setShowCreateIngredient(false)
                              setNewIngredientName('')
                            }}
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info quantités */}
                  <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    💡 Quantités <strong>par personne</strong>
                  </p>

                  {/* Liste des ingrédients actuels */}
                  {(() => {
                    const defaultVariant = selectedDishIngredients.variantIngredients?.find(v => v.is_default)
                    const ingredients = defaultVariant?.linkedIngredients || []

                    if (ingredients.length === 0) {
                      // Fallback: afficher les ingrédients depuis la colonne JSONB
                      let rawIngredients = selectedDishIngredients.ingredients
                      if (typeof rawIngredients === 'string') {
                        try { rawIngredients = JSON.parse(rawIngredients) } catch { rawIngredients = [] }
                      }
                      if (Array.isArray(rawIngredients) && rawIngredients.length > 0) {
                        return (
                          <div className="space-y-2">
                            <div className="border rounded-lg overflow-hidden">
                              <div className="bg-amber-100 px-4 py-2 font-medium text-sm text-amber-800">
                                Ingrédients bruts ({rawIngredients.length})
                              </div>
                              <div className="divide-y">
                                {rawIngredients.map((ing, idx) => (
                                  <div key={idx} className="px-4 py-2 text-sm text-gray-700">
                                    {ing}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-amber-600 italic">
                              Ces ingrédients ne sont pas encore liés au système de variantes.
                              Utilisez la recherche ci-dessus pour les ajouter proprement.
                            </p>
                          </div>
                        )
                      }
                      return (
                        <div className="text-center py-6 text-gray-500">
                          <p className="text-sm">Aucun ingrédient</p>
                          <p className="text-xs mt-1">Recherchez ci-dessus pour en ajouter</p>
                        </div>
                      )
                    }

                    return (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-purple-100 px-4 py-2 font-medium text-sm text-purple-800">
                          Ingrédients ({ingredients.length})
                        </div>
                        <div className="divide-y">
                          {ingredients.map((ing, idx) => (
                            <div key={idx} className="px-4 py-2 flex justify-between items-center text-sm group">
                              <span className="text-gray-700">{ing.ingredient_name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-medium">
                                  {ing.quantity === 0 ? (
                                    <span className="text-amber-600 italic">qsp</span>
                                  ) : (
                                    <>{ing.quantity % 1 === 0 ? ing.quantity : ing.quantity.toFixed(1)} {ing.unit}</>
                                  )}
                                </span>
                                <button
                                  onClick={() => handleRemoveIngredientFromModal(ing.id)}
                                  className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                  title="Retirer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Lien vers variantes avancées */}
                  <button
                    onClick={() => {
                      setShowIngredientsModal(false)
                      openVariantsModal(selectedDishIngredients)
                    }}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200"
                  >
                    🏷️ Gérer les variantes (Halal, Végétarien, etc.)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import OnboardingModal from '@/components/OnboardingModal'
import HistoryModal from '@/components/HistoryModal'
import PopupMessage from '@/components/PopupMessage'
import { generateOrderRecapPDF } from '@/lib/pdf-generator'

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  // Multi-semaines: état pour 4 semaines max
  const [weeklySelections, setWeeklySelections] = useState({
    week0: { dishes: [] },
    week1: { dishes: [] },
    week2: { dishes: [] },
    week3: { dishes: [] }
  })
  const [weekDates, setWeekDates] = useState([])
  const [activeWeek, setActiveWeek] = useState(0)
  const [showNextWeekModal, setShowNextWeekModal] = useState(false)
  const [pendingDishForNextWeek, setPendingDishForNextWeek] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState('viandes')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSummary, setShowSummary] = useState(false)
  const [settingsCompleted, setSettingsCompleted] = useState(true)
  const [showSettingsBanner, setShowSettingsBanner] = useState(false)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false)
  const [showCustomDishModal, setShowCustomDishModal] = useState(false)
  const [customDishFormType, setCustomDishFormType] = useState('simple') // 'simple' ou 'detailed'
  const [customDishForm, setCustomDishForm] = useState({
    dish_name: '',
    description: '',
    suggested_ingredients: []
  })
  const [newIngredient, setNewIngredient] = useState('')
  const [submittingCustomDish, setSubmittingCustomDish] = useState(false)
  const [selectedSeasons, setSelectedSeasons] = useState(['printemps']) // Sera mis à jour par l'API active-season
  const [dietaryTags, setDietaryTags] = useState([])
  const [userDietaryPreferences, setUserDietaryPreferences] = useState([])
  const [userAvoidedIngredients, setUserAvoidedIngredients] = useState([])
  const [userHouseholdSize, setUserHouseholdSize] = useState(1)
  const [favorites, setFavorites] = useState([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showIngredientsSummary, setShowIngredientsSummary] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [resendingRecap, setResendingRecap] = useState(false)
  const [showIngredientsModal, setShowIngredientsModal] = useState(false)
  const [selectedDishForIngredients, setSelectedDishForIngredients] = useState(null)
  const [resettingSelections, setResettingSelections] = useState(false)
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false)
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false)

  // Version de l'app pour détecter les mises à jour
  const APP_VERSION = '2024-01-28-v2'

  const MAX_DISHES_PER_WEEK = 5
  const MAX_WEEKS = 4

  // Getters pour la semaine active
  const selectedDishes = weeklySelections[`week${activeWeek}`]?.dishes || []

  // Compter le total de plats sélectionnés sur toutes les semaines
  const getTotalDishesCount = () => {
    return Object.values(weeklySelections).reduce((total, week) => {
      return total + (week.dishes?.length || 0)
    }, 0)
  }

  // Compter le nombre de semaines avec des plats
  const getActiveWeeksCount = () => {
    return Object.values(weeklySelections).filter(week => week.dishes?.length > 0).length
  }

  // Trouver la première semaine non complète
  const getFirstIncompleteWeek = () => {
    for (let i = 0; i < MAX_WEEKS; i++) {
      const weekDishes = weeklySelections[`week${i}`]?.dishes || []
      if (weekDishes.length < MAX_DISHES_PER_WEEK) {
        return i
      }
    }
    return -1 // Toutes les semaines sont complètes
  }

  // Vérifier si on peut ajouter une nouvelle semaine
  const canAddNextWeek = () => {
    const currentWeekDishes = weeklySelections[`week${activeWeek}`]?.dishes || []
    return currentWeekDishes.length >= MAX_DISHES_PER_WEEK && activeWeek < MAX_WEEKS - 1
  }

  // Vérifier si un plat est en favori
  const isFavorite = (dishId) => favorites.includes(dishId)

  // Toggle favori
  const toggleFavorite = async (dishId, e) => {
    e.stopPropagation() // Ne pas déclencher la sélection du plat

    try {
      if (isFavorite(dishId)) {
        // Retirer des favoris
        const response = await fetch(`/api/favorites?dishId=${dishId}`, {
          method: 'DELETE'
        })
        if (response.ok) {
          setFavorites(prev => prev.filter(id => id !== dishId))
          toast.success('Retiré des favoris')
        }
      } else {
        // Ajouter aux favoris
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dishId })
        })
        if (response.ok) {
          setFavorites(prev => [...prev, dishId])
          toast.success('Ajouté aux favoris')
        }
      }
    } catch (error) {
      console.error('Erreur favori:', error)
      toast.error('Erreur lors de la mise à jour')
    }
  }

  // Charger les favoris
  const fetchFavorites = async () => {
    try {
      const response = await fetch('/api/favorites')
      if (response.ok) {
        const data = await response.json()
        setFavorites(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Erreur chargement favoris:', error)
    }
  }

  // Fonction pour obtenir la saison actuelle
  const getCurrentSeason = () => {
    const month = new Date().getMonth() + 1 // 1-12
    if (month >= 3 && month <= 5) return 'printemps'
    if (month >= 6 && month <= 8) return 'ete'
    if (month >= 9 && month <= 11) return 'automne'
    return 'hiver'
  }

  const seasonEmojis = {
    printemps: '🌸',
    ete: '☀️',
    automne: '🍂',
    hiver: '❄️'
  }

  const seasonLabels = {
    printemps: 'Printemps',
    ete: 'Été',
    automne: 'Automne',
    hiver: 'Hiver'
  }

  // Pour la compatibilité avec getSeasonEmojis
  const seasonOptions = [
    { value: 'printemps', label: 'Printemps', emoji: '🌸' },
    { value: 'ete', label: 'Été', emoji: '☀️' },
    { value: 'automne', label: 'Automne', emoji: '🍂' },
    { value: 'hiver', label: 'Hiver', emoji: '❄️' }
  ]

  // Fonction pour obtenir l'emoji de saison d'un plat
  const getSeasonEmojis = (seasons) => {
    if (!seasons) return ''
    let seasonArray = seasons
    if (typeof seasons === 'string') {
      try {
        seasonArray = JSON.parse(seasons)
      } catch {
        return ''
      }
    }
    if (!Array.isArray(seasonArray) || seasonArray.length === 0) return ''
    if (seasonArray.includes('toutes')) return ''
    return seasonArray.map(s => {
      const option = seasonOptions.find(o => o.value === s)
      return option ? option.emoji : ''
    }).join('')
  }

  // Fonction pour obtenir les ingrédients d'un plat
  const getIngredients = (ingredients) => {
    if (!ingredients) return []
    let ingredientArray = ingredients
    if (typeof ingredients === 'string') {
      try {
        ingredientArray = JSON.parse(ingredients)
      } catch {
        return []
      }
    }
    if (!Array.isArray(ingredientArray)) return []
    return ingredientArray
  }

  // Vérifier la version de l'app au chargement
  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version')
    if (storedVersion && storedVersion !== APP_VERSION) {
      toast.info('Nouvelle version disponible ! La page va se rafraîchir...', {
        duration: 3000
      })
      setTimeout(() => {
        localStorage.setItem('app_version', APP_VERSION)
        window.location.reload()
      }, 3000)
    } else if (!storedVersion) {
      localStorage.setItem('app_version', APP_VERSION)
    }
  }, [])

  // Charger les plats et la sélection existante
  useEffect(() => {
    if (status === 'authenticated') {
      // Les admins sont redirigés vers le panel admin
      if (session?.user?.role === 'admin') {
        router.push('/admin')
        return
      }
      // Vérifier si l'onboarding est nécessaire (seulement pour les clients)
      if (session?.user?.onboarding_completed === false) {
        setShowOnboardingModal(true)
      } else {
        fetchActiveSeason()
        fetchDishes()
        fetchCurrentSelection()
        checkSettings()
        fetchDietaryTags()
        fetchFavorites()
      }
    }
  }, [status, session?.user?.onboarding_completed, session?.user?.role, router])

  const fetchDietaryTags = async () => {
    try {
      const response = await fetch('/api/tags')
      const data = await response.json()
      setDietaryTags(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erreur lors du chargement des tags:', error)
    }
  }

  const checkSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (!data || !data.settings_completed) {
          setSettingsCompleted(false)
          setShowSettingsBanner(true)
        }
        // Charger les préférences alimentaires
        if (data?.dietary_preferences) {
          let prefs = data.dietary_preferences
          if (typeof prefs === 'string') prefs = JSON.parse(prefs)
          setUserDietaryPreferences(prefs || [])
        }
        // Charger les ingrédients évités
        if (data?.avoided_ingredients) {
          let avoided = data.avoided_ingredients
          if (typeof avoided === 'string') avoided = JSON.parse(avoided)
          setUserAvoidedIngredients(avoided || [])
        }
        // Charger le nombre de personnes
        if (data?.household_size) {
          setUserHouseholdSize(data.household_size)
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des paramètres:', error)
    }
  }

  const fetchActiveSeason = async () => {
    try {
      const response = await fetch('/api/active-season')
      if (response.ok) {
        const data = await response.json()
        if (data.active_season) {
          setSelectedSeasons([data.active_season])
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la saison active:', error)
    }
  }

  const fetchDishes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dishes?active=true&includeIngredients=true')
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
        if (data && data.weeks) {
          setWeekDates(data.weeks)

          // Charger les sélections pour chaque semaine (4 semaines max)
          const newSelections = {
            week0: { dishes: [] },
            week1: { dishes: [] },
            week2: { dishes: [] },
            week3: { dishes: [] }
          }

          for (let i = 0; i < MAX_WEEKS; i++) {
            const weekKey = `week${i}`
            const selection = data.selections[weekKey]
            if (selection) {
              newSelections[weekKey].dishes = selection.selected_dishes || []
            }
          }

          setWeeklySelections(newSelections)
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la sélection:', error)
    }
  }

  const toggleDishSelection = (dish) => {
    const dishId = dish.id
    const weekKey = `week${activeWeek}`
    const currentWeekDishes = weeklySelections[weekKey]?.dishes || []

    // Si le plat est déjà sélectionné dans cette semaine, le retirer
    if (currentWeekDishes.includes(dishId)) {
      setWeeklySelections(prev => {
        const weekData = prev[weekKey] || { dishes: [] }
        return {
          ...prev,
          [weekKey]: {
            dishes: weekData.dishes.filter(id => id !== dishId)
          }
        }
      })
      return
    }

    // Si la semaine est pleine, proposer la semaine suivante
    if (currentWeekDishes.length >= MAX_DISHES_PER_WEEK) {
      if (activeWeek < MAX_WEEKS - 1) {
        setPendingDishForNextWeek(dish)
        setShowNextWeekModal(true)
      } else {
        toast.error('Maximum 4 semaines atteint (20 plats)')
      }
      return
    }

    // Ajouter le plat directement
    addDishToWeek(dish, activeWeek)
  }

  // Fonction pour ajouter un plat à une semaine spécifique
  const addDishToWeek = (dish, weekIndex) => {
    const weekKey = `week${weekIndex}`

    setWeeklySelections(prev => {
      const weekData = prev[weekKey] || { dishes: [] }
      return {
        ...prev,
        [weekKey]: {
          dishes: [...weekData.dishes, dish.id]
        }
      }
    })
  }

  // Confirmer l'ajout à la semaine suivante
  const confirmAddToNextWeek = () => {
    if (!pendingDishForNextWeek) return

    const nextWeek = activeWeek + 1
    addDishToWeek(pendingDishForNextWeek, nextWeek)
    setActiveWeek(nextWeek)
    setShowNextWeekModal(false)
    setPendingDishForNextWeek(null)

    const weekDate = weekDates[nextWeek]
    const dateLabel = weekDate ? new Date(weekDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : `semaine ${nextWeek + 1}`
    toast.success(`Plat ajouté pour la ${dateLabel}`)
  }

  // Obtenir l'info d'un tag
  const getTagInfo = (tagName) => {
    const tag = dietaryTags.find(t => t.name === tagName)
    return tag ? { emoji: tag.emoji, name: tag.name } : { emoji: '', name: tagName }
  }

  const handleSaveSelection = async () => {
    // Vérifier qu'au moins une semaine a des plats
    const hasAnyDishes = Object.values(weeklySelections).some(
      week => week && week.dishes && week.dishes.length > 0
    )
    if (!hasAnyDishes) {
      toast.error('Veuillez sélectionner au moins un plat')
      return
    }

    // Vérifier si des semaines ont moins de 5 plats et construire un message d'avertissement
    const incompleteWeeks = []
    Object.entries(weeklySelections).forEach(([weekKey, weekData]) => {
      if (weekData && weekData.dishes && weekData.dishes.length > 0 && weekData.dishes.length < 5) {
        const weekIndex = parseInt(weekKey.replace('week', ''))
        const weekDate = weekDates[weekIndex]
        if (weekDate) {
          const date = new Date(weekDate)
          const formattedDate = date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long'
          })
          incompleteWeeks.push({
            date: formattedDate,
            count: weekData.dishes.length
          })
        }
      }
    })

    // Si des semaines sont incomplètes, demander confirmation
    if (incompleteWeeks.length > 0) {
      let warningMessage = '⚠️ Attention :\n\n'
      incompleteWeeks.forEach(week => {
        warningMessage += `• Semaine du ${week.date} : seulement ${week.count} plat${week.count > 1 ? 's' : ''} sur 5\n`
      })
      warningMessage += '\n💡 Vous pouvez sélectionner jusqu\'à 5 plats par semaine.\n\nVoulez-vous vraiment valider cette sélection ?'

      if (!confirm(warningMessage)) {
        return
      }
    }

    try {
      setSaving(true)
      const response = await fetch('/api/selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklySelections
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
        toast.success('✨ Plat personnalisé ajouté ! Il est maintenant disponible dans le catalogue.')
        setShowCustomDishModal(false)
        setCustomDishForm({
          dish_name: '',
          description: '',
          suggested_ingredients: []
        })
        setCustomDishFormType('simple')
        // Recharger les plats pour afficher le nouveau plat
        fetchDishes()
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

  // Vérifier si un plat est compatible avec les préférences alimentaires
  const isDishCompatible = (dish) => {
    // Vérifier les ingrédients évités spécifiques
    if (userAvoidedIngredients && userAvoidedIngredients.length > 0) {
      const avoidedIds = userAvoidedIngredients.map(a => a.id)
      if (dish.linked_ingredients && dish.linked_ingredients.length > 0) {
        const hasAvoidedIngredient = dish.linked_ingredients.some(
          ing => avoidedIds.includes(ing.ingredient_id)
        )
        if (hasAvoidedIngredient) return false
      }
    }

    // Si pas de préférences tags, le plat est compatible
    if (!userDietaryPreferences || userDietaryPreferences.length === 0) return true

    let dishTags = dish?.dietary_tags || []
    if (typeof dishTags === 'string') {
      try { dishTags = JSON.parse(dishTags) } catch { dishTags = [] }
    }

    // Tags d'exclusion
    const exclusionTags = ['porc', 'produit_laitier', 'gluten', 'poisson', 'fruits_de_mer', 'fruits_a_coque', 'oeuf']
    for (const pref of userDietaryPreferences) {
      if (exclusionTags.includes(pref) && dishTags.includes(pref)) return false
    }

    // Tags de préférence positive (halal, vegetarien, vegan)
    const positiveTags = ['halal', 'vegetarien', 'vegan']
    const userPositivePrefs = userDietaryPreferences.filter(p => positiveTags.includes(p))
    if (userPositivePrefs.length > 0) {
      const hasRequiredTag = userPositivePrefs.some(pref => dishTags.includes(pref))
      if (!hasRequiredTag) return false
    }

    return true
  }

  const getFilteredDishes = () => {
    let filtered = dishes.filter(dish => dish.category === activeCategory)

    // Filtre par saison (multi-select)
    // Si aucune saison sélectionnée → saison actuelle par défaut
    const activeSeasons = selectedSeasons.length > 0 ? selectedSeasons : [getCurrentSeason()]

    filtered = filtered.filter(dish => {
      if (!dish.seasons) return true
      let seasonArray = dish.seasons
      if (typeof dish.seasons === 'string') {
        try {
          seasonArray = JSON.parse(dish.seasons)
        } catch {
          return true
        }
      }
      if (!Array.isArray(seasonArray)) return true
      // Plat visible si "toutes" ou si au moins une saison sélectionnée correspond
      return seasonArray.includes('toutes') || activeSeasons.some(s => seasonArray.includes(s))
    })

    if (searchQuery) {
      filtered = filtered.filter(dish =>
        dish.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filtrer par préférences alimentaires et ingrédients évités
    // Un plat est visible si au moins une de ses variantes est compatible
    const hasFilters = (userDietaryPreferences && userDietaryPreferences.length > 0) ||
                       (userAvoidedIngredients && userAvoidedIngredients.length > 0)

    if (hasFilters) {
      filtered = filtered.filter(dish => isDishCompatible(dish))
    }

    // Filtrer par favoris si activé
    if (showFavoritesOnly) {
      filtered = filtered.filter(dish => favorites.includes(dish.id))
    }

    return filtered
  }

  const categoryLabels = {
    viandes: { name: 'Viandes', emoji: '🥩', color: 'bg-red-500' },
    poissons: { name: 'Poissons', emoji: '🐟', color: 'bg-blue-500' },
    vegetation: { name: 'Végétarien', emoji: '🥗', color: 'bg-green-500' },
    desserts: { name: 'Desserts', emoji: '🍰', color: 'bg-amber-500' }
  }

  // 4 catégories simplifiées pour la liste de courses
  const shoppingCategoryLabels = {
    frais: { name: 'Frais', emoji: '🥩' },
    legumes: { name: 'Légumes', emoji: '🥬' },
    epicerie: { name: 'Épicerie', emoji: '🥫' },
    surgeles: { name: 'Surgelés', emoji: '❄️' }
  }

  // Mapping des catégories de la BDD vers les 4 catégories simplifiées
  const mapToShoppingCategory = (dbCategory) => {
    const mapping = {
      viande: 'frais',
      poisson: 'frais',
      produit_laitier: 'frais',
      oeuf: 'frais',
      legume: 'legumes',
      fruit: 'legumes',
      feculent: 'epicerie',
      epice: 'epicerie',
      condiment: 'epicerie',
      fruits_a_coque: 'epicerie',
      autre: 'epicerie',
      surgele: 'surgeles'
    }
    return mapping[dbCategory] || 'epicerie'
  }

  // Collecter tous les ingrédients des plats sélectionnés par semaine
  const getIngredientsForWeek = (weekIndex) => {
    const weekKey = `week${weekIndex}`
    const weekData = weeklySelections[weekKey]
    const weekDishIds = weekData?.dishes || []

    const ingredientsMap = {}

    weekDishIds.forEach(dishId => {
      const dish = dishes.find(d => d.id === dishId)
      if (!dish) return

      if (dish.linked_ingredients) {
        dish.linked_ingredients.forEach(ing => {
          const key = `${ing.ingredient_id}`
          if (ingredientsMap[key]) {
            // Additionner les quantités si même ingrédient
            ingredientsMap[key].quantity += parseFloat(ing.quantity || 1)
          } else {
            ingredientsMap[key] = {
              id: ing.ingredient_id,
              name: ing.ingredient_name || ing.name,
              category: ing.ingredient_category || ing.category || 'autre',
              quantity: parseFloat(ing.quantity || 1),
              unit: ing.unit || ''
            }
          }
        })
      }
    })

    // Grouper par catégorie simplifiée (4 catégories)
    const grouped = {}
    Object.values(ingredientsMap).forEach(ing => {
      const dbCat = ing.category || 'autre'
      const shoppingCat = mapToShoppingCategory(dbCat)
      if (!grouped[shoppingCat]) grouped[shoppingCat] = []
      grouped[shoppingCat].push({
        ...ing,
        // Multiplier par le nombre de personnes
        totalQuantity: ing.quantity * userHouseholdSize
      })
    })

    return grouped
  }

  // Collecter les ingrédients PAR SEMAINE (seulement semaines futures)
  const getIngredientsByWeek = () => {
    const byWeek = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < MAX_WEEKS; i++) {
      const weekDishes = weeklySelections[`week${i}`]?.dishes || []
      if (weekDishes.length === 0) continue

      // Filtrer les semaines passées
      const weekDate = weekDates[i]
      if (weekDate) {
        const weekDateObj = new Date(weekDate)
        if (weekDateObj < today) continue
      }

      const weekIngredients = getIngredientsForWeek(i)
      if (Object.keys(weekIngredients).length > 0) {
        byWeek.push({
          weekIndex: i,
          weekDate: weekDates[i],
          ingredients: weekIngredients
        })
      }
    }

    return byWeek
  }

  // Collecter tous les ingrédients de toutes les semaines (pour le total)
  const getAllIngredients = () => {
    const allIngredients = {}

    for (let i = 0; i < MAX_WEEKS; i++) {
      const weekIngredients = getIngredientsForWeek(i)
      Object.entries(weekIngredients).forEach(([category, ingredients]) => {
        if (!allIngredients[category]) allIngredients[category] = []
        ingredients.forEach(ing => {
          const existing = allIngredients[category].find(e => e.id === ing.id)
          if (existing) {
            existing.totalQuantity += ing.totalQuantity
          } else {
            allIngredients[category].push({ ...ing })
          }
        })
      })
    }

    return allIngredients
  }

  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  const timeSlots = ['Matin (8h-12h)', 'Midi (12h-14h)', 'Après-midi (14h-18h)', 'Soir (18h-20h)']

  // Renvoyer le récapitulatif des semaines futures
  const handleResendRecap = async () => {
    setResendingRecap(true)
    try {
      const response = await fetch('/api/selections/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Récapitulatif envoyé ! (${data.weeksCount} semaine${data.weeksCount > 1 ? 's' : ''})`)
      } else {
        const error = await response.json()
        if (response.status === 404) {
          toast.error('Aucune sélection future à envoyer')
        } else {
          toast.error(error.error || 'Erreur lors de l\'envoi')
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de l\'envoi du récapitulatif')
    } finally {
      setResendingRecap(false)
    }
  }

  // Ouvrir le modal de confirmation d'annulation
  const handleCancelSelections = () => {
    setShowCancelConfirmModal(true)
  }

  // Confirmer l'annulation des sélections
  const confirmCancelSelections = async () => {
    setShowCancelConfirmModal(false)
    setResettingSelections(true)

    try {
      const response = await fetch('/api/selections/reset', {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('✅ Sélections annulées ! Vous pouvez maintenant refaire votre choix.')
        // Réinitialiser l'état local
        setWeeklySelections({
          week0: { dishes: [], variants: {} },
          week1: { dishes: [], variants: {} },
          week2: { dishes: [], variants: {} },
          week3: { dishes: [], variants: {} }
        })
        // Recharger les sélections
        fetchCurrentSelection()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erreur lors de l\'annulation')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de l\'annulation')
    } finally {
      setResettingSelections(false)
    }
  }

  // Ouvrir le modal de confirmation de réinitialisation (depuis le panier)
  const handleResetSelections = () => {
    setShowResetConfirmModal(true)
  }

  // Confirmer la réinitialisation
  const confirmResetSelections = async () => {
    setShowResetConfirmModal(false)
    setResettingSelections(true)

    try {
      const response = await fetch('/api/selections/reset', {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('✅ Toutes les sélections ont été réinitialisées')
        // Réinitialiser l'état local
        setWeeklySelections({
          week0: { dishes: [], variants: {} },
          week1: { dishes: [], variants: {} },
          week2: { dishes: [], variants: {} },
          week3: { dishes: [], variants: {} }
        })
        setShowSummary(false)
        // Recharger les sélections
        fetchCurrentSelection()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erreur lors de la réinitialisation')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la réinitialisation')
    } finally {
      setResettingSelections(false)
    }
  }

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

  // Fonction appelée quand l'onboarding est terminé
  const handleOnboardingComplete = () => {
    setShowOnboardingModal(false)
    // Rafraîchir la page pour mettre à jour la session
    router.refresh()
    // Charger les données
    fetchDishes()
    fetchCurrentSelection()
    checkSettings() // Charger les paramètres (dont household_size)
    fetchDietaryTags()
    fetchFavorites()
  }

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Modal d'onboarding pour les nouveaux utilisateurs */}
      {showOnboardingModal && (
        <OnboardingModal
          userName={session?.user?.name}
          userEmail={session?.user?.email}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Modal d'historique des commandes */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        userHouseholdSize={userHouseholdSize}
      />

      {/* Popup message de parrainage */}
      <PopupMessage />

      {/* Banner de configuration des paramètres */}
      {showSettingsBanner && (
        <div className="mb-6 bg-primary-100 border-l-4 border-primary-600 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚙️</span>
            <div className="flex-1">
              <h3 className="font-bold text-primary-900 mb-1">Configurez vos paramètres</h3>
              <p className="text-sm text-primary-800 mb-3">
                Pour profiter pleinement du service, veuillez configurer vos créneaux de passage et vos préférences de rappel.
              </p>
              <div className="flex gap-2">
                <a
                  href="/parametres"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition"
                >
                  Configurer maintenant
                </a>
                <button
                  onClick={() => setShowSettingsBanner(false)}
                  className="px-4 py-2 bg-white text-primary-800 rounded-lg text-sm font-semibold hover:bg-primary-50 transition"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bouton flottant de sélection (caché quand modal ouverte) */}
      {getTotalDishesCount() > 0 && !showSummary && (
        <button
          onClick={() => setShowSummary(true)}
          className="fixed bottom-4 right-4 z-50 bg-primary-600 text-white px-6 py-4 rounded-full shadow-lg font-bold flex items-center gap-2 hover:bg-primary-700 transition"
        >
          <span className="text-xl">🛒</span>
          <span>{getTotalDishesCount()} plat{getTotalDishesCount() > 1 ? 's' : ''}</span>
        </button>
      )}

      {/* Modal de confirmation de réinitialisation (depuis le panier) */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Réinitialiser vos sélections ?
              </h3>
              <p className="text-gray-600 text-sm">
                Tous vos plats sélectionnés seront supprimés.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">⚠️</span>
                <div className="text-sm text-red-800">
                  <p className="font-medium">Cette action est irréversible</p>
                  <p className="text-xs mt-1">Vous devrez refaire votre sélection depuis le début.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={confirmResetSelections}
                disabled={resettingSelections}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {resettingSelections ? 'Suppression...' : 'Réinitialiser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de résumé multi-semaines */}
      {showSummary && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-40 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Ma sélection ({getTotalDishesCount()} plats)</h3>
                <button
                  onClick={handleResetSelections}
                  disabled={resettingSelections}
                  className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  <span>🗑️</span>
                  {resettingSelections ? 'Réinitialisation...' : 'Réinitialiser toutes les sélections'}
                </button>
              </div>
              <button
                onClick={() => setShowSummary(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Affichage par semaine */}
            <div className="space-y-4 mb-6">
              {Array.from({ length: MAX_WEEKS }).map((_, weekIndex) => {
                const weekKey = `week${weekIndex}`
                const weekData = weeklySelections[weekKey]
                const weekDishes = weekData?.dishes || []

                // Formater la date de la semaine
                const weekDate = weekDates[weekIndex]

                // Filtrer les semaines passées : ne montrer que les semaines >= aujourd'hui
                if (weekDate) {
                  const weekDateObj = new Date(weekDate)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  // Si la semaine est passée (date < aujourd'hui), ne pas l'afficher
                  if (weekDateObj < today) return null
                }

                let weekLabel = `Semaine ${weekIndex + 1}`
                if (weekDate) {
                  const date = new Date(weekDate)
                  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
                  weekLabel = `Semaine du ${date.getDate()} ${monthNames[date.getMonth()]}`
                }

                if (weekDishes.length === 0) return null

                return (
                  <div key={weekKey} className="border rounded-lg p-3">
                    <h4 className="font-semibold text-sm mb-2 text-gray-700">
                      {weekLabel} ({weekDishes.length}/{MAX_DISHES_PER_WEEK})
                    </h4>
                    <ul className="space-y-1.5">
                      {weekDishes.map(dishId => {
                        const dish = dishes.find(d => d.id === dishId)
                        if (!dish) return null

                        return (
                          <li key={`${weekKey}-${dishId}`} className="flex items-center gap-2 text-sm">
                            <span>{categoryLabels[dish.category]?.emoji}</span>
                            <div className="flex-1">
                              <span>{dish.name}</span>
                            </div>
                            <button
                              onClick={() => {
                                setWeeklySelections(prev => {
                                  const data = prev[weekKey]
                                  return {
                                    ...prev,
                                    [weekKey]: {
                                      dishes: data.dishes.filter(id => id !== dishId)
                                    }
                                  }
                                })
                              }}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              ✕
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Le jour et créneau de passage sont configurés dans vos paramètres.
            </p>

            {/* Section ingrédients */}
            <div className="border-t pt-4 mb-4">
              <button
                type="button"
                onClick={() => setShowIngredientsSummary(!showIngredientsSummary)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🥕</span>
                  <span className="font-semibold">Liste des ingrédients</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {userHouseholdSize} pers.
                  </span>
                </div>
                <span className="text-gray-400">{showIngredientsSummary ? '▲' : '▼'}</span>
              </button>

              {showIngredientsSummary && (
                <div className="mt-4 space-y-6">
                  {getIngredientsByWeek().length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      Aucun ingrédient lié aux plats sélectionnés
                    </p>
                  ) : (
                    getIngredientsByWeek().map((week) => (
                      <div key={week.weekIndex} className="border border-primary-200 rounded-xl overflow-hidden">
                        {/* En-tête de la semaine */}
                        <div className="bg-primary-50 px-3 py-2 border-b border-primary-200">
                          <h4 className="font-bold text-primary-700 text-sm">
                            📅 Semaine du {week.weekDate
                              ? new Date(week.weekDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
                              : `Semaine ${week.weekIndex + 1}`
                            }
                          </h4>
                        </div>
                        {/* Ingrédients de la semaine */}
                        <div className="p-3 space-y-3">
                          {Object.entries(week.ingredients)
                            .sort(([a], [b]) => {
                              const order = ['frais', 'legumes', 'epicerie', 'surgeles']
                              return order.indexOf(a) - order.indexOf(b)
                            })
                            .map(([category, ingredients]) => (
                              <div key={category} className="bg-gray-50 rounded-lg p-2">
                                <h5 className="font-semibold text-xs mb-1 flex items-center gap-1">
                                  <span>{shoppingCategoryLabels[category]?.emoji || '📦'}</span>
                                  {shoppingCategoryLabels[category]?.name || category}
                                </h5>
                                <ul className="space-y-0.5">
                                  {ingredients.map(ing => (
                                    <li key={ing.id} className="text-xs flex justify-between">
                                      <span>{ing.name}</span>
                                      {category !== 'epice' && (
                                        <span className="text-gray-500">
                                          {parseFloat(ing.totalQuantity) % 1 === 0 ? parseFloat(ing.totalQuantity) : parseFloat(ing.totalQuantity).toFixed(1)}
                                          {ing.unit && ` ${ing.unit}`}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleSaveSelection}
              disabled={saving || getTotalDishesCount() === 0}
              className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement...' : '💾 Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">
            Bonjour {session.user.name}!
          </h1>
          <div className="flex items-center gap-2">
            {/* Bouton Annuler la sélection - toujours visible */}
            <button
              onClick={handleCancelSelections}
              disabled={resettingSelections}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium text-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Annuler mes sélections validées"
            >
              <span>🗑️</span>
              <span className="hidden sm:inline">{resettingSelections ? 'Annulation...' : 'Annuler la sélection'}</span>
            </button>
            <button
              onClick={handleResendRecap}
              disabled={resendingRecap}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-100 hover:bg-primary-200 rounded-lg text-sm font-medium text-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>📧</span>
              <span className="hidden sm:inline">{resendingRecap ? 'Envoi...' : 'Renvoyer récap'}</span>
            </button>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition"
            >
              <span>📋</span>
              <span className="hidden sm:inline">Historique</span>
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Sélectionnez jusqu'à {MAX_DISHES_PER_WEEK} plats par semaine
        </p>
      </div>

      {/* Indicateur de progression */}
      <div className="mb-4 bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <div>
              <p className="font-semibold text-sm">
                {weekDates[activeWeek]
                  ? `Semaine du ${new Date(weekDates[activeWeek]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
                  : `Semaine ${activeWeek + 1}`
                }
              </p>
              <p className="text-xs text-gray-500">
                {selectedDishes.length}/{MAX_DISHES_PER_WEEK} plats sélectionnés
              </p>
            </div>
          </div>
          {getTotalDishesCount() > 0 && (
            <div className="text-right">
              <p className="text-lg font-bold text-primary-600">
                {getTotalDishesCount()}/{Math.max(1, getActiveWeeksCount()) * MAX_DISHES_PER_WEEK}
              </p>
              <p className="text-xs text-gray-500">{getActiveWeeksCount()} semaine{getActiveWeeksCount() > 1 ? 's' : ''}</p>
            </div>
          )}
        </div>

        {/* Barre de progression pour la semaine en cours */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${(selectedDishes.length / MAX_DISHES_PER_WEEK) * 100}%` }}
          />
        </div>

        {/* Navigation entre semaines - toujours visible */}
        <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-gray-100 overflow-x-auto">
          {Array.from({ length: MAX_WEEKS }).map((_, weekIndex) => {
            const weekDishes = weeklySelections[`week${weekIndex}`]?.dishes || []
            const weekDate = weekDates[weekIndex]
            let label = `Sem ${weekIndex + 1}`
            if (weekDate) {
              const date = new Date(weekDate)
              const monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']
              label = `${date.getDate()} ${monthNames[date.getMonth()]}`
            }

            return (
              <button
                key={weekIndex}
                onClick={() => setActiveWeek(weekIndex)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition flex-shrink-0 ${
                  activeWeek === weekIndex
                    ? 'bg-primary-600 text-white shadow-sm'
                    : weekDishes.length > 0
                      ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <span className="block">{label}</span>
                <span className="block text-[10px] opacity-75">
                  {weekDishes.length > 0 ? `${weekDishes.length} plat${weekDishes.length > 1 ? 's' : ''}` : 'vide'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Onglets de catégories - responsive */}
      <div className="flex gap-2 mb-3 justify-center flex-wrap">
        {Object.entries(categoryLabels).map(([category, { name, emoji, color }]) => {
          const count = dishes.filter(d => d.category === category).length
          return (
            <button
              key={category}
              onClick={() => {
                setActiveCategory(category)
                setSearchQuery('')
                setShowFavoritesOnly(false)
              }}
              className={`flex-shrink-0 px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                activeCategory === category && !showFavoritesOnly
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
        {/* Bouton Favoris */}
        <button
          onClick={() => {
            setShowFavoritesOnly(!showFavoritesOnly)
            setSearchQuery('')
          }}
          className={`flex-shrink-0 px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 ${
            showFavoritesOnly
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <span className="text-lg">{showFavoritesOnly ? '⭐' : '☆'}</span>
          <span className="sm:hidden text-sm font-bold">{favorites.length}</span>
          <span className="hidden sm:inline text-sm font-semibold">Favoris ({favorites.length})</span>
        </button>
      </div>

      {/* Saison active */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary-600 text-white">
            <span>{seasonEmojis[selectedSeasons[0]] || '📅'}</span>
            <span>{
              selectedSeasons[0] === 'printemps' ? 'Printemps' :
              selectedSeasons[0] === 'ete' ? 'Été' :
              selectedSeasons[0] === 'automne' ? 'Automne' :
              selectedSeasons[0] === 'hiver' ? 'Hiver' : 'Toutes saisons'
            }</span>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher un plat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                onClick={() => toggleDishSelection(dish)}
                className={`p-2.5 rounded-lg border-2 cursor-pointer transition relative ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-primary-300'
                }`}
              >
                {/* Bouton favori */}
                {/* Boutons en haut à droite */}
                <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1">
                  {/* Bouton ingrédients */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedDishForIngredients(dish)
                      setShowIngredientsModal(true)
                    }}
                    className="w-8 h-8 flex items-center justify-center text-lg transition-transform hover:scale-110 text-amber-600 hover:text-amber-700"
                    title="Voir les ingrédients"
                  >
                    🥕
                  </button>
                  {/* Bouton favori */}
                  <button
                    onClick={(e) => toggleFavorite(dish.id, e)}
                    className={`w-8 h-8 flex items-center justify-center text-xl transition-transform hover:scale-110 ${
                      isFavorite(dish.id) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                    }`}
                    title={isFavorite(dish.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    {isFavorite(dish.id) ? '⭐' : '☆'}
                  </button>
                </div>

                <div className="flex items-center gap-2.5 pr-20">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                    isSelected ? 'bg-primary-600 text-white' : 'bg-gray-200'
                  }`}>
                    {isSelected && '✓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-medium text-sm leading-tight">
                        {dish.name}
                      </h3>
                      {dish.kids_food && (
                        <span className="text-xs bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-medium" title="Kids Food">
                          👶
                        </span>
                      )}
                      {dish.description?.includes('(Plat personnalisé)') && (
                        <span className="text-xs bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-medium">
                          ✨ Personnalisé
                        </span>
                      )}
                      {getSeasonEmojis(dish.seasons) && (
                        <span className="text-xs flex-shrink-0" title="Saisons">
                          {getSeasonEmojis(dish.seasons)}
                        </span>
                      )}
                    </div>
                    {dish.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                        {dish.description.replace(' (Plat personnalisé)', '')}
                      </p>
                    )}
                    {getIngredients(dish.ingredients).length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                        <span className="text-amber-600">🥕</span>{' '}
                        {getIngredients(dish.ingredients).slice(0, 4).join(', ')}
                        {getIngredients(dish.ingredients).length > 4 && '...'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de proposition semaine suivante */}
      {showNextWeekModal && pendingDishForNextWeek && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="text-center mb-4">
              <span className="text-4xl mb-3 block">🎉</span>
              <h3 className="text-xl font-bold mb-2">Semaine complète !</h3>
              <p className="text-gray-600">
                Vous avez sélectionné {MAX_DISHES_PER_WEEK} plats pour cette semaine.
              </p>
            </div>

            <div className="bg-primary-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-primary-800">
                <strong>Voulez-vous ajouter "{pendingDishForNextWeek.name}"</strong> pour la semaine suivante ?
              </p>
              {weekDates[activeWeek + 1] && (
                <p className="text-xs text-primary-600 mt-1">
                  Semaine du {new Date(weekDates[activeWeek + 1]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmAddToNextWeek}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700"
              >
                Oui, ajouter
              </button>
              <button
                onClick={() => {
                  setShowNextWeekModal(false)
                  setPendingDishForNextWeek(null)
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                Non merci
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation d'annulation */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {/* Icône et titre */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Annuler vos sélections ?
              </h3>
              <p className="text-gray-600 text-sm">
                Cette action supprimera tous vos plats sélectionnés pour les semaines à venir.
              </p>
            </div>

            {/* Informations */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">💡</span>
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Que se passe-t-il ensuite ?</p>
                  <ul className="space-y-1 text-xs">
                    <li>✓ Vos sélections actuelles seront effacées</li>
                    <li>✓ Vous pourrez refaire votre choix</li>
                    <li>✓ Un email récapitulatif sera envoyé après validation</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirmModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={confirmCancelSelections}
                disabled={resettingSelections}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {resettingSelections ? 'Annulation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'affichage des ingrédients */}
      {showIngredientsModal && selectedDishForIngredients && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span>🥕</span>
                  {selectedDishForIngredients.name}
                </h3>
                <p className="text-sm text-gray-500">Ingrédients du plat</p>
              </div>
              <button
                onClick={() => {
                  setShowIngredientsModal(false)
                  setSelectedDishForIngredients(null)
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Affichage des ingrédients du plat */}
            <div className="space-y-4">
              {selectedDishForIngredients.linked_ingredients && selectedDishForIngredients.linked_ingredients.length > 0 ? (
                <div className="bg-gray-50 rounded-lg p-3">
                  <ul className="space-y-2">
                    {selectedDishForIngredients.linked_ingredients.map((ing) => (
                      <li key={ing.ingredient_id || ing.id} className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-800">
                            {ing.ingredient_name || ing.name}
                          </span>
                          {ing.dietary_tags && (() => {
                            let dietaryTags = ing.dietary_tags
                            if (typeof dietaryTags === 'string') {
                              try { dietaryTags = JSON.parse(dietaryTags) } catch { dietaryTags = [] }
                            }
                            if (Array.isArray(dietaryTags) && dietaryTags.length > 0) {
                              return (
                                <div className="flex flex-wrap gap-0.5 mt-0.5">
                                  {dietaryTags.map(tagName => {
                                    const tagInfo = getTagInfo(tagName)
                                    return (
                                      <span key={tagName} className="text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded" title={tagInfo.name}>
                                        {tagInfo.emoji}
                                      </span>
                                    )
                                  })}
                                </div>
                              )
                            }
                            return null
                          })()}
                        </div>
                        {ing.quantity && (
                          <span className="text-sm text-gray-600 whitespace-nowrap">
                            {ing.quantity} {ing.unit || ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (() => {
                let rawIngredients = selectedDishForIngredients.ingredients
                if (typeof rawIngredients === 'string') {
                  try { rawIngredients = JSON.parse(rawIngredients) } catch { rawIngredients = [] }
                }
                if (Array.isArray(rawIngredients) && rawIngredients.length > 0) {
                  return (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <ul className="space-y-1.5">
                        {rawIngredients.map((ing, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0"></span>
                            {ing}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                }
                return (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      Les ingrédients de ce plat ne sont pas encore détaillés.
                    </p>
                  </div>
                )
              })()}
            </div>

            {/* Note pour le nombre de personnes */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <span>ℹ️</span>
                Les quantités affichées sont pour 1 personne. Les quantités finales seront ajustées selon le nombre de personnes de votre foyer ({userHouseholdSize} pers.).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de demande de plat personnalisé */}
      {showCustomDishModal && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
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

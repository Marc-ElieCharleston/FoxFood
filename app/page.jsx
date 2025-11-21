'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [dishes, setDishes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [selectedDishes, setSelectedDishes] = useState([])

  // État du formulaire
  const [formData, setFormData] = useState({
    name: '',
    category: 'viande',
    ingredients: [{ name: '', quantity: '' }]
  })

  // Charger les plats depuis le localStorage
  useEffect(() => {
    const savedDishes = localStorage.getItem('foxfood-dishes')
    if (savedDishes) {
      setDishes(JSON.parse(savedDishes))
    }
  }, [])

  // Sauvegarder les plats dans le localStorage
  const saveDishes = (newDishes) => {
    localStorage.setItem('foxfood-dishes', JSON.stringify(newDishes))
    setDishes(newDishes)
  }

  // Ajouter un ingrédient au formulaire
  const addIngredientField = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { name: '', quantity: '' }]
    })
  }

  // Mettre à jour un ingrédient
  const updateIngredient = (index, field, value) => {
    const newIngredients = [...formData.ingredients]
    newIngredients[index][field] = value
    setFormData({ ...formData, ingredients: newIngredients })
  }

  // Supprimer un ingrédient
  const removeIngredient = (index) => {
    const newIngredients = formData.ingredients.filter((_, i) => i !== index)
    setFormData({ ...formData, ingredients: newIngredients })
  }

  // Soumettre le formulaire
  const handleSubmit = (e) => {
    e.preventDefault()
    const newDish = {
      id: Date.now(),
      ...formData,
      ingredients: formData.ingredients.filter(ing => ing.name && ing.quantity)
    }
    saveDishes([...dishes, newDish])
    setFormData({
      name: '',
      category: 'viande',
      ingredients: [{ name: '', quantity: '' }]
    })
    setShowForm(false)
  }

  // Supprimer un plat
  const deleteDish = (id) => {
    saveDishes(dishes.filter(dish => dish.id !== id))
  }

  // Gérer la sélection des plats pour la liste de courses
  const toggleDishSelection = (dishId) => {
    setSelectedDishes(prev =>
      prev.includes(dishId)
        ? prev.filter(id => id !== dishId)
        : [...prev, dishId]
    )
  }

  // Générer la liste de courses
  const generateShoppingList = () => {
    const selectedDishesData = dishes.filter(dish => selectedDishes.includes(dish.id))

    // Regrouper les ingrédients
    const ingredientsMap = {}
    selectedDishesData.forEach(dish => {
      dish.ingredients.forEach(ing => {
        if (ingredientsMap[ing.name]) {
          ingredientsMap[ing.name] += `, ${ing.quantity}`
        } else {
          ingredientsMap[ing.name] = ing.quantity
        }
      })
    })

    // Créer le texte de la liste
    let listText = '🛒 LISTE DE COURSES - FoxFood\n\n'
    listText += `Plats sélectionnés:\n${selectedDishesData.map(d => `- ${d.name}`).join('\n')}\n\n`
    listText += 'Ingrédients:\n'
    Object.entries(ingredientsMap).forEach(([name, quantity]) => {
      listText += `- ${name}: ${quantity}\n`
    })

    return listText
  }

  // Copier la liste dans le presse-papier
  const copyToClipboard = () => {
    const list = generateShoppingList()
    navigator.clipboard.writeText(list)
    alert('Liste copiée dans le presse-papier!')
  }

  // Partager par SMS/email
  const shareList = () => {
    const list = generateShoppingList()
    const encodedList = encodeURIComponent(list)

    // Créer un lien mailto
    window.location.href = `mailto:?subject=Liste de courses FoxFood&body=${encodedList}`
  }

  const categoryColors = {
    viande: 'bg-red-100 text-red-800',
    poisson: 'bg-blue-100 text-blue-800',
    vegetation: 'bg-green-100 text-green-800'
  }

  const categoryEmojis = {
    viande: '🥩',
    poisson: '🐟',
    vegetation: '🥗'
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Section d'ajout de plat */}
      <div className="mb-8">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition"
          >
            ➕ Ajouter un plat
          </button>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Nouveau plat</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2">
                  Nom du plat
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2">
                  Catégorie
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="viande">🥩 Viande</option>
                  <option value="poisson">🐟 Poisson</option>
                  <option value="vegetation">🥗 Végétarien</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 font-bold mb-2">
                  Ingrédients
                </label>
                {formData.ingredients.map((ing, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Ingrédient"
                      value={ing.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <input
                      type="text"
                      placeholder="Quantité"
                      value={ing.quantity}
                      onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {formData.ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addIngredientField}
                  className="mt-2 text-orange-600 hover:text-orange-700 font-semibold"
                >
                  + Ajouter un ingrédient
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-2 px-4 rounded-lg"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Section de génération de liste de courses */}
      {selectedDishes.length > 0 && (
        <div className="mb-8 bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
          <h3 className="font-bold text-lg mb-3">
            📋 {selectedDishes.length} plat(s) sélectionné(s)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
            >
              📋 Copier la liste
            </button>
            <button
              onClick={shareList}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
            >
              📧 Envoyer par email
            </button>
            <button
              onClick={() => setSelectedDishes([])}
              className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
            >
              ✖️ Tout déselectionner
            </button>
          </div>
        </div>
      )}

      {/* Liste des plats */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Mes plats ({dishes.length})</h2>
        {dishes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Aucun plat enregistré. Commencez par ajouter votre premier plat!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dishes.map(dish => (
              <div
                key={dish.id}
                className={`bg-white p-4 rounded-lg shadow-md border-2 transition ${
                  selectedDishes.includes(dish.id) ? 'border-orange-500' : 'border-transparent'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{dish.name}</h3>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${categoryColors[dish.category]}`}>
                      {categoryEmojis[dish.category]} {dish.category}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteDish(dish.id)}
                    className="text-red-500 hover:text-red-700 text-xl"
                  >
                    🗑️
                  </button>
                </div>

                <div className="mt-3 mb-3">
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Ingrédients:</h4>
                  <ul className="text-sm space-y-1">
                    {dish.ingredients.map((ing, idx) => (
                      <li key={idx} className="text-gray-600">
                        • {ing.name}: {ing.quantity}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => toggleDishSelection(dish.id)}
                  className={`w-full py-2 px-4 rounded-lg font-semibold transition ${
                    selectedDishes.includes(dish.id)
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {selectedDishes.includes(dish.id) ? '✓ Sélectionné' : 'Sélectionner'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

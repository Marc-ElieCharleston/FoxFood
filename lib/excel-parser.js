import * as XLSX from 'xlsx'

/**
 * Parse un fichier Excel de plats avec ingrédients
 * Format attendu:
 * | Nom | Catégorie | Description | Saisons | Ingrédients |
 *
 * Catégories valides: viandes, poissons, vegetation
 * Saisons: printemps, ete, automne, hiver, toutes (séparées par virgule)
 * Ingrédients: format "quantité+unité:nom" séparés par virgule
 *   Exemple: "200g:poulet, 100g:riz, 2pc:oeufs, 1c.a.s:huile"
 *   Unités: g, kg, ml, L, pc (pièce), c.a.s (cuillère à soupe)
 */

// Parser les ingrédients depuis une string
function parseIngredients(ingredientsStr) {
  if (!ingredientsStr || typeof ingredientsStr !== 'string') return []

  const ingredients = []
  const parts = ingredientsStr.split(',').map(p => p.trim()).filter(Boolean)

  for (const part of parts) {
    // Format: "quantité+unité:nom" ou "quantité unité:nom" ou juste "nom"
    // Permet aussi 0 comme quantité (pour les épices "à volonté")
    const match = part.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|L|pc|pcs|piece|pieces|c\.?a\.?s\.?|cas|qsp)?\s*[:\-]?\s*(.+)$/i)

    if (match) {
      const quantity = parseFloat(match[1].replace(',', '.'))
      let unit = (match[2] || 'g').toLowerCase()
      const name = match[3].trim()

      // Normaliser les unités
      if (unit === 'pcs' || unit === 'piece' || unit === 'pieces') unit = 'pc'
      if (unit === 'cas' || unit === 'c.a.s.' || unit === 'cas.') unit = 'c.a.s'
      if (unit === 'qsp') unit = 'qsp' // Quantité suffisante pour (à volonté)

      if (name) {
        ingredients.push({ quantity, unit, name })
      }
    } else {
      // Si pas de quantité, juste le nom = épice à volonté (quantité 0)
      const name = part.replace(/^[:\-]\s*/, '').trim()
      if (name) {
        ingredients.push({ quantity: 0, unit: 'qsp', name })
      }
    }
  }

  return ingredients
}

export function parseExcelDishes(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  // Prendre la première feuille
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  // Convertir en JSON
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

  if (rows.length < 2) {
    throw new Error('Le fichier doit contenir au moins une ligne d\'en-tête et une ligne de données')
  }

  // Première ligne = en-têtes
  const headers = rows[0].map(h => String(h).toLowerCase().trim())

  // Trouver les colonnes
  const nameIdx = headers.findIndex(h => h.includes('nom') || h === 'name')
  const categoryIdx = headers.findIndex(h => h.includes('catégorie') || h.includes('categorie') || h === 'category')
  const descIdx = headers.findIndex(h => h.includes('description') || h === 'desc')
  const seasonsIdx = headers.findIndex(h => h.includes('saison') || h === 'seasons')
  const ingredientsIdx = headers.findIndex(h => h.includes('ingrédient') || h.includes('ingredient') || h === 'ingredients')

  if (nameIdx === -1) {
    throw new Error('Colonne "Nom" non trouvée')
  }
  if (categoryIdx === -1) {
    throw new Error('Colonne "Catégorie" non trouvée')
  }

  // Valider et mapper les catégories
  const categoryMap = {
    'viande': 'viandes',
    'viandes': 'viandes',
    'meat': 'viandes',
    'poisson': 'poissons',
    'poissons': 'poissons',
    'fish': 'poissons',
    'végétarien': 'vegetation',
    'vegetarien': 'vegetation',
    'végé': 'vegetation',
    'vege': 'vegetation',
    'vegetation': 'vegetation',
    'vegetarian': 'vegetation',
    'dessert': 'desserts',
    'desserts': 'desserts',
    'gouter': 'desserts',
    'goûter': 'desserts',
    'dessert ou gouter': 'desserts',
    'dessert ou goûter': 'desserts'
  }

  // Mapper les saisons
  const seasonMap = {
    'printemps': 'printemps',
    'spring': 'printemps',
    'été': 'ete',
    'ete': 'ete',
    'summer': 'ete',
    'automne': 'automne',
    'autumn': 'automne',
    'fall': 'automne',
    'hiver': 'hiver',
    'winter': 'hiver',
    'toutes': 'toutes',
    'all': 'toutes',
    'toute l\'année': 'toutes'
  }

  const dishes = []
  const errors = []

  // Parser chaque ligne (en commençant à la ligne 2)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const lineNum = i + 1

    // Ignorer les lignes vides
    if (!row || row.length === 0 || !row[nameIdx]) {
      continue
    }

    const name = String(row[nameIdx]).trim()
    const rawCategory = String(row[categoryIdx] || '').toLowerCase().trim()
    const description = descIdx !== -1 ? String(row[descIdx] || '').trim() : ''
    const rawSeasons = seasonsIdx !== -1 ? String(row[seasonsIdx] || 'toutes').toLowerCase().trim() : 'toutes'
    const rawIngredients = ingredientsIdx !== -1 ? String(row[ingredientsIdx] || '').trim() : ''

    // Valider la catégorie
    const category = categoryMap[rawCategory]
    if (!category) {
      errors.push(`Ligne ${lineNum}: Catégorie invalide "${rawCategory}" pour "${name}"`)
      continue
    }

    // Parser les saisons
    const seasonsList = rawSeasons.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    const seasons = seasonsList.map(s => seasonMap[s] || s).filter(s => seasonMap[s] || s === 'toutes')

    if (seasons.length === 0) {
      seasons.push('toutes')
    }

    // Parser les ingrédients
    const ingredients = parseIngredients(rawIngredients)

    dishes.push({
      name,
      category,
      description,
      seasons,
      ingredients, // Liste d'objets {quantity, unit, name}
      active: true
    })
  }

  return { dishes, errors }
}

/**
 * Génère un fichier Excel template pour l'import de plats
 */
export function generateDishTemplate() {
  const data = [
    ['Nom', 'Catégorie', 'Description', 'Saisons', 'Ingrédients'],
    ['Poulet rôti aux herbes', 'viandes', 'Poulet fermier rôti avec pommes de terre', 'toutes', '200g:poulet, 150g:pommes de terre, 2c.a.s:huile olive, 1pc:oignon, 0:sel, 0:poivre'],
    ['Saumon grillé légumes', 'poissons', 'Pavé de saumon avec haricots verts', 'printemps, ete', '180g:saumon, 120g:haricots verts, 30g:beurre, 1pc:citron, 0:aneth'],
    ['Risotto champignons', 'vegetation', 'Risotto crémeux aux champignons de Paris', 'automne, hiver', '100g:riz arborio, 150g:champignons, 50ml:vin blanc, 30g:parmesan, 0:sel, 0:poivre'],
    ['Boeuf bourguignon', 'viandes', 'Mijoté de boeuf au vin rouge', 'automne, hiver', '200g:boeuf, 100g:carottes, 100g:oignons, 100ml:vin rouge, 50g:lardons, 0:thym'],
    ['Curry de légumes', 'vegetation', 'Curry doux aux légumes de saison', 'toutes', '100g:pois chiches, 100g:courgettes, 100g:aubergines, 100ml:lait coco, 1c.a.s:curry, 0:sel']
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Plats')

  // Ajuster les largeurs de colonnes
  ws['!cols'] = [
    { width: 30 },
    { width: 15 },
    { width: 45 },
    { width: 20 },
    { width: 80 }
  ]

  // Ajouter une feuille d'instructions
  const instructions = [
    ['INSTRUCTIONS D\'IMPORT'],
    [''],
    ['FORMAT DES COLONNES:'],
    ['- Nom: Nom du plat (obligatoire)'],
    ['- Catégorie: viandes, poissons ou vegetation (obligatoire)'],
    ['- Description: Description libre du plat'],
    ['- Saisons: printemps, ete, automne, hiver, toutes (séparées par virgule)'],
    ['- Ingrédients: liste au format "quantité+unité:nom" séparés par virgule'],
    [''],
    ['FORMAT DES INGRÉDIENTS:'],
    ['- Quantité suivie de l\'unité, puis ":" et le nom'],
    ['- Exemples: 200g:poulet, 100ml:lait, 2pc:oeufs, 1c.a.s:huile'],
    ['- Pour les épices (sel, poivre, etc.): utiliser 0 comme quantité'],
    ['- Exemple épices: 0:sel, 0:poivre, 0:herbes de Provence'],
    [''],
    ['UNITÉS SUPPORTÉES:'],
    ['- g (grammes)'],
    ['- kg (kilogrammes)'],
    ['- ml (millilitres)'],
    ['- L (litres)'],
    ['- pc (pièce)'],
    ['- c.a.s (cuillère à soupe)'],
    ['- 0 ou qsp (quantité à volonté, non calculée)'],
    [''],
    ['NOTES:'],
    ['- Les ingrédients inexistants seront créés automatiquement'],
    ['- Les plats existants (même nom) seront ignorés'],
    ['- Une variante "Classique" sera créée automatiquement']
  ]

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions)
  wsInstructions['!cols'] = [{ width: 60 }]
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

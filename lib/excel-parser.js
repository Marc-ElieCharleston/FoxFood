import * as XLSX from 'xlsx'

/**
 * Parse un fichier Excel de plats
 * Format attendu:
 * | Nom | Catégorie | Description | Saisons |
 *
 * Catégories valides: viandes, poissons, vegetation
 * Saisons: printemps, ete, automne, hiver, toutes (séparées par virgule)
 */
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
    'vegetarian': 'vegetation'
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

    dishes.push({
      name,
      category,
      description,
      seasons,
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
    ['Nom', 'Catégorie', 'Description', 'Saisons'],
    ['Exemple Poulet', 'viandes', 'Poulet rôti aux herbes', 'toutes'],
    ['Exemple Saumon', 'poissons', 'Saumon grillé', 'printemps, ete'],
    ['Exemple Risotto', 'vegetation', 'Risotto aux champignons', 'automne, hiver']
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Plats')

  // Ajuster les largeurs de colonnes
  ws['!cols'] = [
    { width: 30 },
    { width: 15 },
    { width: 40 },
    { width: 25 }
  ]

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

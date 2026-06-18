#!/usr/bin/env node
/**
 * Parse le fichier ETE 2026.xlsx et produit:
 *   - scripts/ete-2026-plats.json  (données structurées pour l'import)
 *   - ETE_2026_RECAP.md            (récap pour validation par le chef)
 *
 * Ne modifie PAS la base de données. Utiliser scripts/import-ete-2026.js après validation.
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const xlsx = require('xlsx')
const { sql } = require('@vercel/postgres')

const XLSX_PATH = path.join(__dirname, '..', 'ETE 2026.xlsx')
const JSON_OUT = path.join(__dirname, 'ete-2026-plats.json')
const RECAP_OUT = path.join(__dirname, '..', 'ETE_2026_RECAP.md')

const SECTION_TO_CATEGORY = {
  vegetation: 'vegetation',
  poisson: 'poissons',
  viande: 'viandes',
  dessert: 'desserts',
}

// Dictionnaire d'accents (français). Appliqué après lowercase.
// Garde-fou: chaque règle utilise \b pour éviter les faux positifs internes.
const ACCENT_FIXES = [
  // Locutions multi-mots d'abord
  [/\bl[eé]gumes? d['’]?ete\b/gi, "légumes d'été"],
  [/\bd['’]ete\b/gi, "d'été"],
  [/\bsucre\/sale\b/gi, 'sucré/salé'],
  [/\bcroq mr\b/gi, 'CroQ Mr'],
  [/\bfacon fox food\b/gi, 'façon Fox food'],
  [/\blegumes?\b/gi, m => 'légume' + (m.endsWith('s') ? 's' : '')],
  [/\ba la /gi, 'à la '],
  [/\ba l['’]/gi, "à l'"],

  // E → É (début de mot)
  [/\bete\b/gi, 'été'],
  [/\becrasee\b/gi, 'écrasée'],
  [/\becrasees\b/gi, 'écrasées'],
  [/\bemince\b/gi, 'émincé'],
  [/\beminces\b/gi, 'émincés'],
  [/\bepinards?\b/gi, m => 'é' + m.slice(1)],
  [/\bechalote(s)?\b/gi, m => 'é' + m.slice(1)],
  [/\bceleri\b/gi, 'céleri'],

  // E → É (autres positions, mots spécifiques)
  [/\bcafe\b/gi, 'café'],
  [/\bcr[eé]me(s)?\b/gi, m => 'crème' + (m.toLowerCase().endsWith('s') ? 's' : '')],
  [/\bcremeuse?s?\b/gi, m => m.replace(/cremeus/i, 'crémeus').replace(/cremeu(?!s)/i, 'crémeu')],
  [/\bcremeux\b/gi, 'crémeux'],
  [/\bchevre\b/gi, 'chèvre'],
  [/\bdecortiquees?\b/gi, m => 'décortiquée' + (m.endsWith('s') ? 's' : '')],
  [/\bpur[eé]es?\b/gi, m => 'purée' + (m.endsWith('s') ? 's' : '')],
  [/\bs[eé]same\b/gi, 'sésame'],
  [/\bs[eé]ch[eé]es?\b/gi, m => 'séchée' + (m.endsWith('s') ? 's' : '')],
  [/\bs[eé]ch[eé]s?\b/gi, m => 'séché' + (m.endsWith('s') ? 's' : '')],

  // Pavé / fumé / grillé / râpé / poêlé / rôti / panés
  [/\bpave\b/gi, 'pavé'],
  [/\bpaves\b/gi, 'pavés'],
  [/\bfum[eé]es?\b/gi, m => 'fumée' + (m.endsWith('s') ? 's' : '')],
  [/\bfum[eé]s?\b/gi, m => 'fumé' + (m.endsWith('s') ? 's' : '')],
  [/\bgrill[eé]es?\b/gi, m => 'grillée' + (m.endsWith('s') ? 's' : '')],
  [/\bgrill[eé]s?\b/gi, m => 'grillé' + (m.endsWith('s') ? 's' : '')],
  [/\brap[eé]es?\b/gi, m => 'râpée' + (m.endsWith('s') ? 's' : '')],
  [/\brap[eé]s?\b/gi, m => 'râpé' + (m.endsWith('s') ? 's' : '')],
  [/\bpo[eê]l[eé]es?\b/gi, m => 'poêlée' + (m.endsWith('s') ? 's' : '')],
  [/\bpo[eê]l[eé]s?\b/gi, m => 'poêlé' + (m.endsWith('s') ? 's' : '')],
  [/\bpo[eê]le\b/gi, 'poêle'],
  [/\bpan[eé]es?\b/gi, m => 'panée' + (m.endsWith('s') ? 's' : '')],
  [/\bpan[eé]s?\b/gi, m => 'pané' + (m.endsWith('s') ? 's' : '')],
  [/\broti(e)?s?\b/gi, m => m.replace(/^rot/i, 'rôt')],

  // Pâte / pâtes
  [/\bpate(s)? brisee\b/gi, m => m.replace(/pate/i, 'pâte').replace(/brisee/i, 'brisée')],
  [/\bpates?\b/gi, m => 'pâte' + (m.endsWith('s') ? 's' : '')],

  // Mots fréquents non-é
  [/\bappellations?\b/gi, 'Appellations'],
  [/\bble\b/gi, 'blé'],
  [/\bfacon\b/gi, 'façon'],
  [/\bfideua\b/gi, 'fideuà'],
  [/\bfraicheur\b/gi, 'fraîcheur'],
  [/\bfeves?\b/gi, m => 'fève' + (m.endsWith('s') ? 's' : '')],
  [/\bgateau\b/gi, 'gâteau'],
  [/\bgateaux\b/gi, 'gâteaux'],
  [/\bmafe\b/gi, 'mafé'],
  [/\bmais\b/gi, 'maïs'],
  [/\bmache\b/gi, 'mâche'],
  [/\bnicoise\b/gi, 'niçoise'],
  [/\boeufs?\b/gi, m => m.toLowerCase().endsWith('s') ? 'œufs' : 'œuf'],
  [/\bpaella\b/gi, 'paëlla'],
  [/\bpapates?\b/gi, m => 'patate' + (m.endsWith('s') ? 's' : '')],
  [/\bpissaladiere\b/gi, 'pissaladière'],
  [/\bprovencale\b/gi, 'provençale'],
  [/\bprovencales\b/gi, 'provençales'],
  [/\brostis?\b/gi, m => 'rösti' + (m.endsWith('s') ? 's' : '')],
  [/\btoscane\b/gi, 'toscane'],
  [/\btosacane\b/gi, 'toscane'],
  [/\bvegetarien(ne)?s?\b/gi, m => 'végétarien' + m.slice(11)],
  [/\bvegetariens\b/gi, 'végétariens'],
  [/\bcesar\b/gi, 'César'],
  [/\bmijote\b/gi, 'mijoté'],
  [/\bmijotes\b/gi, 'mijotés'],
  [/\bmijoteuse\b/gi, 'mijoteuse'],

  // Normalisation espaces / ponctuation
  [/\s*&\s*/g, ' & '],
  [/\s+,\s*/g, ', '],
  [/\s{2,}/g, ' '],
]

function cleanName(raw) {
  let s = raw.trim().replace(/\s+/g, ' ')
  // Lowercase tout puis Title : première lettre majuscule
  s = s.toLowerCase()
  // Restaure les apostrophes typographiques telles quelles
  // Applique le dictionnaire d'accents
  for (const [re, rep] of ACCENT_FIXES) {
    s = s.replace(re, rep)
  }
  // Première lettre en majuscule
  s = s.charAt(0).toUpperCase() + s.slice(1)
  // Nettoyage final
  s = s.replace(/\s+$/, '').replace(/\s+,/g, ',').replace(/,(?!\s)/g, ', ')
  return s
}

function parseIngredients(raw) {
  if (!raw || !raw.trim()) return []
  // Protège les virgules décimales (ex: "12,25 CL", "1,5 PCE") pour ne pas couper dessus
  const protectedStr = raw.replace(/(\d),(\d)/g, '$1‧$2')
  return protectedStr.split(',')
    .map(x => x.trim().replace(/‧/g, ',').replace(/\s+/g, ' '))
    .filter(x => x.length > 0)
    .map(x => x.toUpperCase())
}

function readExcel() {
  const wb = xlsx.readFile(XLSX_PATH)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const json = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const sectionOrder = ['vegetation', 'poisson', 'viande', 'dessert']
  let sectionIndex = 0
  let currentSection = null
  const items = []

  for (let i = 0; i < json.length; i++) {
    const row = json[i]
    if (row[0] === 'APPELATIONS') {
      currentSection = sectionOrder[sectionIndex++]
      continue
    }
    if (!row[0] || typeof row[0] !== 'string' || row[0].trim() === '') continue
    items.push({
      excelRow: i + 1,
      section: currentSection,
      rawName: row[0].trim(),
      rawIngredients: (row[1] || '').trim(),
      autres: (row[2] || '').trim(),
    })
  }
  return items
}

function normalizeForMatch(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s) {
  const stop = new Set(['de','du','des','la','le','les','au','aux','a','et','un','une','en','sur','dans','d','l','rouge','rouges','vert','verts','blanc','blancs','jaune','jaunes','noir','noirs','sel','poivre','gros','petit','grand','grands','grande'])
  return normalizeForMatch(s).split(' ').filter(t => t.length >= 3 && !stop.has(t))
}

function similarity(a, b) {
  const ta = tokens(a), tb = tokens(b)
  if (ta.length === 0 || tb.length === 0) return 0
  const setB = new Set(tb)
  const common = ta.filter(t => setB.has(t)).length
  return common / Math.max(ta.length, tb.length)
}

async function main() {
  console.log('📖 Lecture du fichier Excel...')
  const items = readExcel()
  console.log(`   ${items.length} plats lus.`)

  console.log('\n📡 Chargement du catalogue actuel...')
  const r = await sql`SELECT id, name, category, seasons, active FROM dishes WHERE active = true`
  const dbDishes = r.rows.map(d => ({
    ...d,
    seasons: Array.isArray(d.seasons) ? d.seasons : (d.seasons ? JSON.parse(d.seasons) : []),
  }))
  console.log(`   ${dbDishes.length} plats actifs en base.`)

  // Plats à étendre saison 'ete' = ceux marqués 'RECETTE XXX' dans la colonne AUTRES
  const recycled = []
  const newDishes = []

  for (const it of items) {
    const isRecycled = /RECETTE/i.test(it.autres)
    const cleanedName = cleanName(it.rawName)
    const category = SECTION_TO_CATEGORY[it.section]
    const ingredients = parseIngredients(it.rawIngredients)

    if (isRecycled) {
      // Recherche du plat correspondant par similarité
      const scored = dbDishes
        .map(d => ({ d, score: similarity(cleanedName, d.name) }))
        .sort((a, b) => b.score - a.score)
      const best = scored[0]

      // Cas spéciaux nom-à-nom (override par nom cleané → id du plat catalogue)
      const overrides = {
        'Wok de boeuf aux légumes d\'été': 246,
        'Wok de bœuf aux légumes d\'été': 246,
        'Wok de poulet aux légume d\'été': 245,
        'Wok de poulet aux légumes d\'été': 245,
        'Œuf dur à l\'espagnol': 222,
        'Oeuf dur à l\'espagnol': 222,
      }
      const overrideId = overrides[cleanedName]

      const matched = overrideId
        ? dbDishes.find(d => d.id === overrideId)
        : (best && best.score >= 0.5 ? best.d : null)

      recycled.push({
        excelRow: it.excelRow,
        section: it.section,
        category,
        rawName: it.rawName,
        cleanedName,
        marker: it.autres,
        matched: matched ? {
          id: matched.id,
          name: matched.name,
          currentSeasons: matched.seasons,
          needsEte: !matched.seasons.includes('ete') && !matched.seasons.includes('toutes'),
        } : null,
        matchScore: best ? best.score : 0,
        candidates: scored.slice(0, 3).map(s => ({ id: s.d.id, name: s.d.name, score: +s.score.toFixed(2), seasons: s.d.seasons })),
      })
    } else {
      newDishes.push({
        excelRow: it.excelRow,
        section: it.section,
        category,
        rawName: it.rawName,
        cleanedName,
        ingredients,
        ingredientsRaw: it.rawIngredients,
        seasons: ['ete'],
        kids_food: false,
        active: true,
      })
    }
  }

  const data = { generatedAt: new Date().toISOString(), recycled, newDishes }
  fs.writeFileSync(JSON_OUT, JSON.stringify(data, null, 2), 'utf8')
  console.log(`\n💾 JSON écrit: ${JSON_OUT}`)

  // === RECAP MARKDOWN ===
  const lines = []
  lines.push('# Récap import Été 2026')
  lines.push('')
  lines.push(`_Généré le ${new Date().toISOString().split('T')[0]} à partir de \`ETE 2026.xlsx\`_`)
  lines.push('')
  lines.push('## Vue d\'ensemble')
  lines.push('')
  lines.push(`- **Total plats dans le fichier** : ${items.length}`)
  lines.push(`  - Végétation : ${items.filter(i => i.section === 'vegetation').length}`)
  lines.push(`  - Poisson    : ${items.filter(i => i.section === 'poisson').length}`)
  lines.push(`  - Viande     : ${items.filter(i => i.section === 'viande').length}`)
  lines.push(`  - Dessert    : ${items.filter(i => i.section === 'dessert').length}`)
  lines.push('')
  lines.push(`- **Plats existants à étendre à la saison \`ete\`** : ${recycled.length}`)
  lines.push(`- **Nouveaux plats à créer** : ${newDishes.length}`)
  lines.push('')

  lines.push('---')
  lines.push('')
  lines.push('## ♻️ Plats existants à étendre à la saison "ete"')
  lines.push('')
  lines.push('| Excel | Nom catalogue actuel | Catégorie | Saisons actuelles | Action |')
  lines.push('|---|---|---|---|---|')
  for (const r of recycled) {
    if (!r.matched) {
      lines.push(`| ${r.rawName} (${r.marker}) | ❌ **AUCUN MATCH** | ${r.category} | — | À CONFIRMER manuellement |`)
      continue
    }
    const action = r.matched.needsEte ? `Ajouter \`ete\`` : `Déjà visible (\`toutes\` ou \`ete\` présent)`
    lines.push(`| ${r.rawName} | [${r.matched.id}] ${r.matched.name} | ${r.category} | ${r.matched.currentSeasons.join(', ')} | ${action} |`)
  }
  lines.push('')

  // Section "à confirmer" pour les recycled sans match
  const noMatch = recycled.filter(r => !r.matched)
  if (noMatch.length > 0) {
    lines.push('### ⚠️ Recyclés sans match automatique (à valider)')
    lines.push('')
    for (const r of noMatch) {
      lines.push(`- **${r.rawName}** _(${r.marker})_`)
      lines.push(`  - Meilleurs candidats : ${r.candidates.map(c => `[${c.id}] ${c.name} (${c.score})`).join(' / ')}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## 🆕 Nouveaux plats à créer')
  lines.push('')

  for (const cat of ['vegetation', 'poissons', 'viandes', 'desserts']) {
    const inCat = newDishes.filter(d => d.category === cat)
    if (inCat.length === 0) continue
    lines.push(`### ${cat} (${inCat.length})`)
    lines.push('')
    for (const d of inCat) {
      lines.push(`#### ${d.cleanedName}`)
      lines.push('')
      lines.push(`- **Catégorie** : ${d.category}`)
      lines.push(`- **Saisons** : \`ete\``)
      lines.push(`- **Nom Excel original** : \`${d.rawName}\``)
      if (d.ingredients.length === 0) {
        lines.push(`- **Ingrédients** : ⚠️ AUCUN (cellule vide dans l'Excel)`)
      } else {
        lines.push(`- **Ingrédients** (${d.ingredients.length}) :`)
        d.ingredients.forEach(ing => lines.push(`  - ${ing}`))
      }
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push('## Prochaines étapes')
  lines.push('')
  lines.push('1. **Relire ce récap** et signaler tout nom mal écrit / accent manquant / catégorie incorrecte')
  lines.push('2. **Décider** pour chaque nouveau plat si `kids_food` doit être `true` (par défaut : `false`)')
  lines.push('3. **Lancer l\'import** : `node scripts/import-ete-2026.js`')
  lines.push('   - Le script lit `scripts/ete-2026-plats.json`')
  lines.push('   - Pour les recyclés : `UPDATE dishes SET seasons = seasons || \'["ete"]\'` si manquant')
  lines.push('   - Pour les nouveaux : `INSERT INTO dishes` avec `seasons=[\'ete\']` et `active=true`')
  lines.push('   - Idempotent (skip les noms déjà existants)')
  lines.push('')

  fs.writeFileSync(RECAP_OUT, lines.join('\n'), 'utf8')
  console.log(`📄 Récap écrit: ${RECAP_OUT}`)

  // === Résumé console ===
  console.log('\n========== RÉSUMÉ ==========')
  console.log(`Recyclés à étendre 'ete' : ${recycled.length}`)
  console.log(`  - matchés       : ${recycled.filter(r => r.matched).length}`)
  console.log(`  - sans match    : ${recycled.filter(r => !r.matched).length}`)
  console.log(`  - déjà 'ete'    : ${recycled.filter(r => r.matched && !r.matched.needsEte).length}`)
  console.log(`Nouveaux plats   : ${newDishes.length}`)
  for (const cat of ['vegetation', 'poissons', 'viandes', 'desserts']) {
    console.log(`  - ${cat.padEnd(12)} : ${newDishes.filter(d => d.category === cat).length}`)
  }
  console.log(`Plats sans ingrédients : ${newDishes.filter(d => d.ingredients.length === 0).length}`)

  process.exit(0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })

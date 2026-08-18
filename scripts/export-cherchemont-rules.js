#!/usr/bin/env node
/**
 * Régénère CHERCHEMONT_REGLES.md à partir de la base.
 *
 * Le fichier est la version lisible par le chef de ce que le script d'overrides
 * a écrit : il se relit avant un service, pas en interrogeant Postgres. Il doit
 * donc être régénéré après chaque `setup-cherchemont-overrides.js`.
 *
 *   node scripts/export-cherchemont-rules.js
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')
const fs = require('fs')
const path = require('path')

const USER_ID = 14
const OUT = path.join(__dirname, '..', 'CHERCHEMONT_REGLES.md')

const CATEGORY_LABELS = {
  feculent: '🌾 Féculents',
  produit_laitier: '🥛 Laitages',
  legume: '🥬 Légumes',
  fruit: '🍎 Fruits',
  viande: '🥩 Viandes',
  poisson: '🐟 Poissons',
  condiment: '🧂 Condiments',
  epice: '🌿 Épices',
  oeuf: '🥚 Œufs',
  fruits_a_coque: '🥜 Fruits à coque',
  autre: '📦 Autres'
}

async function run() {
  const overrides = await sql`
    SELECT o.*, d.name as dish_name, d.seasons
    FROM user_dish_overrides o
    JOIN dishes d ON d.id = o.dish_id
    WHERE o.user_id = ${USER_ID}
    ORDER BY d.name
  `
  const ingredients = await sql`SELECT id, name, category FROM ingredients`
  const ing = new Map(ingredients.rows.map(r => [r.id, r]))
  const nom = id => ing.get(id)?.name || `#${id}`
  const cat = id => ing.get(id)?.category || 'autre'

  const rows = overrides.rows
  const modifies = rows.filter(r => r.action !== 'hide')
  const masques = rows.filter(r => r.action === 'hide')
  const renommes = modifies.filter(r => r.custom_name)

  // Agrégations : une même règle vaut souvent pour des dizaines de plats
  const subs = new Map()      // "from→to" -> { from, to, dishes[] }
  const retraits = new Map()  // ingredientId -> dishes[]
  const ajouts = new Map()    // "id|qty|unit" -> { id, qty, unit, dishes[] }

  for (const o of modifies) {
    const label = o.custom_name || o.dish_name
    for (const s of o.substitute_ingredients || []) {
      const key = `${s.from_ingredient_id}→${s.to_ingredient_id}${s.quantity != null ? `@${s.quantity}${s.unit || ''}` : ''}`
      if (!subs.has(key)) subs.set(key, { from: s.from_ingredient_id, to: s.to_ingredient_id, quantity: s.quantity, unit: s.unit, dishes: [] })
      subs.get(key).dishes.push(label)
    }
    for (const r of o.remove_ingredients || []) {
      if (!retraits.has(r.ingredient_id)) retraits.set(r.ingredient_id, [])
      retraits.get(r.ingredient_id).push(label)
    }
    for (const a of o.add_ingredients || []) {
      const key = `${a.ingredient_id}|${a.quantity}|${a.unit || ''}`
      if (!ajouts.has(key)) ajouts.set(key, { id: a.ingredient_id, quantity: a.quantity, unit: a.unit, dishes: [] })
      ajouts.get(key).dishes.push(label)
    }
  }

  const aujourdhui = new Date().toISOString().split('T')[0]
  const L = []
  L.push("# Règles d'éviction et de substitution — Mme Cherchemont", '')
  L.push(`_Généré depuis la base le ${aujourdhui} — ${rows.length} overrides actifs._`)
  L.push('_Source de vérité : `scripts/setup-cherchemont-overrides.js`. Ne pas éditer à la main._', '')

  L.push('## Vue d\'ensemble', '')
  L.push('| Type d\'action | Nombre |', '|---|---|')
  L.push(`| Plats avec adaptation | ${modifies.length} |`)
  L.push(`| Règles de **substitution** distinctes | ${subs.size} |`)
  L.push(`| Règles de **suppression** d'ingrédient | ${retraits.size} |`)
  L.push(`| Règles d'**ajout** d'ingrédient | ${ajouts.size} |`)
  L.push(`| Plats **masqués** (jamais proposés) | ${masques.length} |`)
  L.push(`| Plats **renommés** (nom personnalisé) | ${renommes.length} |`)
  L.push('', '---', '')

  // Substitutions, groupées par catégorie de l'ingrédient évité
  L.push('## 🔄 Substitutions d\'ingrédients', '')
  L.push('_Pour chaque ingrédient évité, son remplaçant et le nombre de plats concernés._', '')
  const parCategorie = new Map()
  for (const s of subs.values()) {
    const c = cat(s.from)
    if (!parCategorie.has(c)) parCategorie.set(c, [])
    parCategorie.get(c).push(s)
  }
  for (const [c, liste] of [...parCategorie].sort((a, b) => b[1].length - a[1].length)) {
    L.push(`### ${CATEGORY_LABELS[c] || c}`, '')
    L.push('| Ingrédient évité | Remplacé par | Quantité imposée | Nb plats |', '|---|---|---|---|')
    liste.sort((a, b) => b.dishes.length - a.dishes.length)
    for (const s of liste) {
      const q = s.quantity != null ? `${s.quantity} ${s.unit || ''}`.trim() : '—'
      L.push(`| ${nom(s.from)} | **${nom(s.to)}** | ${q} | ${s.dishes.length} |`)
    }
    L.push('')
  }

  L.push('---', '')
  L.push('## ❌ Ingrédients supprimés (sans remplacement)', '')
  L.push('| Ingrédient | Catégorie | Nb plats | Plats |', '|---|---|---|---|')
  for (const [id, dishes] of [...retraits].sort((a, b) => b[1].length - a[1].length)) {
    L.push(`| ${nom(id)} | ${CATEGORY_LABELS[cat(id)] || cat(id)} | ${dishes.length} | ${dishes.join(', ')} |`)
  }
  L.push('')

  if (ajouts.size > 0) {
    L.push('---', '')
    L.push('## ✚ Ingrédients ajoutés', '')
    L.push('_Ajoutés à la recette pour elle ; cumulés si le plat en contient déjà._', '')
    L.push('| Ingrédient | Quantité | Plats |', '|---|---|---|')
    for (const a of [...ajouts.values()].sort((x, y) => nom(x.id).localeCompare(nom(y.id), 'fr'))) {
      L.push(`| ${nom(a.id)} | ${a.quantity} ${a.unit || ''} | ${a.dishes.join(', ')} |`)
    }
    L.push('')
  }

  L.push('---', '')
  L.push('## 🚫 Plats masqués (jamais proposés)', '')
  masques.sort((a, b) => a.dish_name.localeCompare(b.dish_name, 'fr'))
  masques.forEach(m => L.push(`- [${m.dish_id}] ${m.dish_name}`))
  L.push('')

  L.push('---', '')
  L.push('## ✏️ Plats renommés (nom personnalisé)', '')
  L.push('| Nom catalogue | Nom personnalisé |', '|---|---|')
  renommes.sort((a, b) => a.dish_name.localeCompare(b.dish_name, 'fr'))
  renommes.forEach(r => L.push(`| ${r.dish_name} | **${r.custom_name}** |`))
  L.push('')

  const decrits = modifies.filter(r => r.custom_description)
  if (decrits.length > 0) {
    L.push('---', '')
    L.push('## ✎ Descriptions personnalisées', '')
    L.push('_La phrase affichée sous le nom du plat. Celle du catalogue annonçait des_')
    L.push('_ingrédients qu\'elle ne reçoit pas ; celle-ci décrit ce qui part chez elle._', '')
    L.push('| Plat | Description affichée |', '|---|---|')
    decrits.sort((a, b) => (a.custom_name || a.dish_name).localeCompare(b.custom_name || b.dish_name, 'fr'))
    decrits.forEach(r => L.push(`| ${r.custom_name || r.dish_name} | ${r.custom_description} |`))
    L.push('')
  }

  fs.writeFileSync(OUT, L.join('\n'), 'utf8')
  console.log(`✅ ${OUT} régénéré — ${rows.length} overrides, ${subs.size} substitutions, ${ajouts.size} ajouts`)
}

run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1) })

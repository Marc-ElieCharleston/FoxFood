#!/usr/bin/env node
/**
 * Script pour insérer les overrides de Mme Cherchemont (user_id=14)
 * Centralise toutes les modifications dans user_dish_overrides
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const USER_ID = 14

// === RÈGLES GLOBALES (s'appliquent à tous les plats contenant ces ingrédients) ===
const GLOBAL_SUBSTITUTIONS = [
  // Crème fraîche → Semi épais soja
  { from: 17, to: 292 },   // Creme fraiche
  { from: 171, to: 292 },  // Creme fraiche epaisse
  { from: 211, to: 292 },  // Creme fraiche liquide
  // Farine → Maïzena
  { from: 26, to: 95 },
  // Lait de vache → Lait de soja
  { from: 16, to: 288 },
  // Beurre → Huile d'olive
  { from: 18, to: 44 },
  // Yaourt → Yaourt soja
  { from: 100, to: 282 },
  { from: 364, to: 282 },
  // Fromage blanc → Yaourt soja
  { from: 63, to: 282 },
  // Boursin → Feta
  { from: 234, to: 115 },
  // Ricotta → Feta
  { from: 293, to: 115 },
  // Fromages de vache → Brebis
  { from: 19, to: 195 },   // Fromage rapé
  { from: 20, to: 195 },   // Parmesan
  { from: 21, to: 195 },   // Mozzarella
  { from: 69, to: 195 },   // Parmesan rapé
  { from: 72, to: 195 },   // Cheddar rapé
  { from: 156, to: 195 },  // Reblochon
  { from: 172, to: 195 },  // Comté rapé
  { from: 175, to: 195 },  // Mozzarella rapée
  { from: 184, to: 195 },  // Fromage à tartiflette
  { from: 206, to: 195 },  // Emmental rapé
  { from: 212, to: 195 },  // Parmesan poudre
  { from: 219, to: 195 },  // Burrata
  { from: 223, to: 195 },  // Cheddar
  { from: 294, to: 195 },  // Philadelphia
  { from: 375, to: 195 },  // Mozzarella bille
  { from: 383, to: 195 },  // Copeau de parmesan
  { from: 397, to: 195 },  // Fromage à burger
]

const GLOBAL_FROM_IDS = new Set(GLOBAL_SUBSTITUTIONS.map(s => s.from))
const GLOBAL_SUB_MAP = new Map(GLOBAL_SUBSTITUTIONS.map(s => [s.from, s.to]))

// === OVERRIDES SPÉCIFIQUES (par plat) ===
// Format: { dishId, customName?, removeIngredients?, substituteIngredients?, action? }
const SPECIFIC_OVERRIDES = [
  // --- PAGE 1 ---
  // Salade boulgour: boulgour → quinoa
  { dishId: 286, substituteIngredients: [{ from: 190, to: 113 }] },
  // Tarte courgette/feta → Clafoutis + retirer pâte
  { dishId: 285, customName: 'Clafoutis courgette/feta', removeIngredients: [194] },
  // Tortilla asperges → Clafoutis + retirer PDT
  { dishId: 296, customName: "Clafoutis d'asperges vertes", removeIngredients: [103] },
  // Tortilla épinards → Clafoutis + retirer PDT
  { dishId: 297, customName: 'Clafoutis aux épinards', removeIngredients: [103] },
  // Courgette farcie pizza: mozza rapée → brebis (déjà global)
  { dishId: 237 },
  // Curry courgette: riz → haricot rouge
  { dishId: 230, customName: 'Curry de courgette au chorizo & haricots rouges', substituteIngredients: [{ from: 23, to: 222 }] },
  // Fideuà: pâte fideua → perles de konjac
  { dishId: 253, substituteIngredients: [{ from: 306, to: 415 }] },
  // Navarin agneau: retirer PDT grenailles
  { dishId: 254, removeIngredients: [89] },
  // Paella végé: riz → quinoa
  { dishId: 298, customName: 'Paella végétarienne au tofu (quinoa)', substituteIngredients: [{ from: 23, to: 113 }] },
  // Salade pâtes: fusilli → tagliatelle konjac
  { dishId: 256, substituteIngredients: [{ from: 374, to: 291 }] },
  // Salade riz thaï: riz → sarrasin
  { dishId: 248, customName: 'Salade de sarrasin thaï au poulet', substituteIngredients: [{ from: 23, to: 414 }] },
  // Spaghetti bolo: spaghetti → tagliatelle konjac
  { dishId: 243, substituteIngredients: [{ from: 278, to: 291 }] },

  // --- PAGE 2 ---
  // Amok: riz thai → pois chiche
  { dishId: 274, substituteIngredients: [{ from: 97, to: 119 }] },
  // Bagel saumon: pain bagel → pain SS gluten
  { dishId: 258, substituteIngredients: [{ from: 362, to: 347 }] },
  // Bruschetta saumon: déjà pain SS gluten, rien de spécifique
  { dishId: 272 },
  // Cabillaud miso: boulgour → quinoa
  { dishId: 280, substituteIngredients: [{ from: 190, to: 113 }] },
  // Curry crevettes patate douce: patate douce → carottes (même qté)
  { dishId: 210, substituteIngredients: [{ from: 92, to: 30 }] },
  // Lasagne saumon courgette: farine+beurre→maïzena (global), retirer pâte lasagne, courgettes 100→250g
  { dishId: 270, removeIngredients: [227] },
  // Quiche saumon boursin → Clafoutis, retirer pâte, parmesan→brebis (global), crème→soja (global)
  { dishId: 259, customName: 'Clafoutis au saumon fumé, boursin & asperge verte', removeIngredients: [194] },
  // Salade asiatique: vermicelle chinois → tagliatelle konjac
  { dishId: 263, substituteIngredients: [{ from: 411, to: 291 }] },
  // Salade tahitienne: riz thai → perles de konjac
  { dishId: 262, customName: 'Salade tahitienne au saumon & konjac', substituteIngredients: [{ from: 97, to: 415 }] },
  // Saumon en croûte: PDT→chou-fleur +100g, parmesan→brebis (global)
  { dishId: 261, substituteIngredients: [{ from: 103, to: 220 }] },
  // Boulettes lentilles: retirer patate douce
  { dishId: 303, removeIngredients: [92] },
  // Chow mein boeuf: nouilles oeufs → tagliatelle konjac
  { dishId: 128, substituteIngredients: [{ from: 77, to: 291 }] },
  // Chow mein porc: nouille chinoises → tagliatelle konjac
  { dishId: 158, substituteIngredients: [{ from: 132, to: 291 }] },
  // Chow mein poulet: nouilles oeufs → tagliatelle konjac
  { dishId: 136, substituteIngredients: [{ from: 77, to: 291 }] },
  // Chow mein légumes: nouille aux oeufs → tagliatelle konjac
  { dishId: 179, substituteIngredients: [{ from: 224, to: 291 }] },
  // Dhal lentilles: retirer patate douce, ajouter carottes +100g (sub patate douce → carottes)
  { dishId: 173, substituteIngredients: [{ from: 92, to: 30 }] },
  // Falafel: patate douce → pousse de soja (même qté 200g)
  { dishId: 287, substituteIngredients: [{ from: 92, to: 85 }] },
  // Feuilleté chèvre/miel: pâte feuilletée → pain SS gluten
  { dishId: 288, substituteIngredients: [{ from: 225, to: 347 }] },
  // Mafé haricots rouges: riz basmati → sarrasin
  { dishId: 291, customName: 'Mafé aux haricots rouges & sarrasin', substituteIngredients: [{ from: 405, to: 414 }] },
  // Mujadara: riz complet → perles de konjac
  { dishId: 284, customName: 'Mujadara au konjac', substituteIngredients: [{ from: 331, to: 415 }] },
  // Nasi Goreng: riz thai → perles de konjac
  { dishId: 300, customName: 'Nasi Goreng au konjac', substituteIngredients: [{ from: 97, to: 415 }] },
  // Pad thaï tofu: nouille de riz → tagliatelle konjac
  { dishId: 290, substituteIngredients: [{ from: 108, to: 291 }] },
  // Risotto asperges: riz risotto → perles konjac, crème→soja (global), parmesan→brebis (global)
  { dishId: 295, customName: 'Risotto de konjac aux asperges', substituteIngredients: [{ from: 217, to: 415 }] },
  // Risotto milanaise: riz risotto → perles konjac, copeau parmesan→brebis (global), parmesan poudre→brebis (global)
  { dishId: 299, customName: 'Risotto de konjac à la milanaise', substituteIngredients: [{ from: 217, to: 415 }] },
  // Risotto potiron: riz risotto → perles konjac, crème→soja (global), parmesan→brebis (global)
  { dishId: 175, customName: 'Risotto de konjac au potiron', substituteIngredients: [{ from: 217, to: 415 }] },
  // Risotto crevettes: riz risotto → perles konjac, crème→soja (global), parmesan→brebis (global)
  { dishId: 211, customName: 'Risotto de konjac aux crevettes, butternut & champignons', substituteIngredients: [{ from: 217, to: 415 }] },
]

// === PLATS À MASQUER ===
const HIDDEN_DISHES = [
  242,  // CroQ Mr façon Fox food
  239,  // Filet de poulet pané (printemps)
  240,  // Hachis parmentier
  241,  // Mac & cheese crémeux au jambon (printemps)
  234,  // Pinsa Romana
  233,  // Pâté de Pâques
  247,  // Tourte de boeuf façon empanadas
  235,  // Wrap épinards, feta & bacon
  194,  // Brandade de colin
  195,  // Brandade de sardines
]

async function run() {
  console.log(`🔧 Setup overrides pour Mme Cherchemont (user_id=${USER_ID})\n`)

  // 1. Charger tous les plats printemps actifs avec leurs ingrédients
  const allDishes = await sql`
    SELECT d.id, d.name, array_agg(di.ingredient_id) as ingredient_ids
    FROM dishes d
    LEFT JOIN dish_ingredients di ON di.dish_id = d.id
    WHERE d.active = true
    AND (d.seasons @> '"printemps"'::jsonb OR d.seasons @> '"toutes"'::jsonb)
    GROUP BY d.id, d.name
  `

  const dishIngMap = new Map()
  allDishes.rows.forEach(d => {
    dishIngMap.set(d.id, {
      name: d.name,
      ingredientIds: (d.ingredient_ids || []).filter(Boolean)
    })
  })

  // 2. Pour chaque plat, calculer les substitutions globales applicables
  const overridesMap = new Map() // dishId -> { customName, removeIngredients, substituteIngredients, action }

  // D'abord, appliquer les overrides globaux à tous les plats
  for (const [dishId, dishInfo] of dishIngMap) {
    const globalSubs = []
    for (const ingId of dishInfo.ingredientIds) {
      if (GLOBAL_SUB_MAP.has(ingId)) {
        globalSubs.push({ from_ingredient_id: ingId, to_ingredient_id: GLOBAL_SUB_MAP.get(ingId) })
      }
    }
    if (globalSubs.length > 0) {
      overridesMap.set(dishId, {
        action: 'modify',
        customName: null,
        removeIngredients: [],
        substituteIngredients: globalSubs
      })
    }
  }

  // 3. Fusionner les overrides spécifiques (priorité sur global)
  for (const spec of SPECIFIC_OVERRIDES) {
    const existing = overridesMap.get(spec.dishId) || {
      action: 'modify',
      customName: null,
      removeIngredients: [],
      substituteIngredients: []
    }

    if (spec.customName) {
      existing.customName = spec.customName
    }

    if (spec.removeIngredients) {
      for (const ingId of spec.removeIngredients) {
        if (!existing.removeIngredients.some(r => r.ingredient_id === ingId)) {
          existing.removeIngredients.push({ ingredient_id: ingId })
        }
        // Retirer aussi de substituteIngredients si c'était un remplacement global
        existing.substituteIngredients = existing.substituteIngredients.filter(s => s.from_ingredient_id !== ingId)
      }
    }

    if (spec.substituteIngredients) {
      for (const sub of spec.substituteIngredients) {
        // Remplacer le global par le spécifique s'il existe
        existing.substituteIngredients = existing.substituteIngredients.filter(s => s.from_ingredient_id !== sub.from)
        existing.substituteIngredients.push({ from_ingredient_id: sub.from, to_ingredient_id: sub.to })
      }
    }

    overridesMap.set(spec.dishId, existing)
  }

  // 4. Ajouter les plats masqués
  for (const dishId of HIDDEN_DISHES) {
    overridesMap.set(dishId, {
      action: 'hide',
      customName: null,
      removeIngredients: [],
      substituteIngredients: []
    })
  }

  // 5. Supprimer les anciens overrides
  await sql`DELETE FROM user_dish_overrides WHERE user_id = ${USER_ID}`
  console.log('🗑️  Anciens overrides supprimés')

  // 6. Insérer les nouveaux
  let inserted = 0
  let modifyCount = 0
  let hideCount = 0

  for (const [dishId, override] of overridesMap) {
    const dishInfo = dishIngMap.get(dishId)
    await sql`
      INSERT INTO user_dish_overrides (user_id, dish_id, action, custom_name, remove_ingredients, substitute_ingredients)
      VALUES (
        ${USER_ID},
        ${dishId},
        ${override.action},
        ${override.customName},
        ${JSON.stringify(override.removeIngredients)}::jsonb,
        ${JSON.stringify(override.substituteIngredients)}::jsonb
      )
    `
    inserted++
    if (override.action === 'hide') {
      hideCount++
      console.log(`  🚫 HIDE: ${dishInfo?.name || dishId}`)
    } else {
      modifyCount++
      const parts = []
      if (override.customName) parts.push(`rename→"${override.customName}"`)
      if (override.removeIngredients.length) parts.push(`remove:${override.removeIngredients.length}`)
      if (override.substituteIngredients.length) parts.push(`sub:${override.substituteIngredients.length}`)
      console.log(`  ✏️  MODIFY: ${dishInfo?.name || dishId} [${parts.join(', ')}]`)
    }
  }

  console.log(`\n✅ ${inserted} overrides insérés (${modifyCount} modifications, ${hideCount} masquages)`)

  // 7. Vérification
  const check = await sql`
    SELECT COUNT(*) as total FROM user_dish_overrides WHERE user_id = ${USER_ID}
  `
  console.log(`📊 Vérification: ${check.rows[0].total} overrides en base`)

  process.exit(0)
}

run().catch(e => { console.error('❌', e.message); process.exit(1) })

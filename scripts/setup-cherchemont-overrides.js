#!/usr/bin/env node
/**
 * Règles d'adaptation de Mme Cherchemont (user_id=14) — SOURCE DE VÉRITÉ.
 *
 * Ce fichier est la référence : le script efface puis réinsère TOUS ses overrides.
 * Une modification faite directement en base (ou par un autre script) est donc
 * perdue au prochain run — toute nouvelle règle doit être ajoutée ici.
 *
 *   node scripts/setup-cherchemont-overrides.js --dry        # simulation, n'écrit rien
 *   node scripts/setup-cherchemont-overrides.js              # écrit en base
 *   node scripts/setup-cherchemont-overrides.js --user=42    # applique le même jeu de
 *                                                            # règles à un compte de test
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const CHERCHEMONT_USER_ID = 14
const userArg = process.argv.find(a => a.startsWith('--user='))
const USER_ID = userArg ? parseInt(userArg.split('=')[1], 10) : CHERCHEMONT_USER_ID
const DRY_RUN = process.argv.includes('--dry')

if (Number.isNaN(USER_ID)) {
  console.error('❌ --user= attend un identifiant numérique')
  process.exit(1)
}

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
  { from: 416, to: 195 },  // Gouda        (ajout été 2026, cf. CroQ Mr courgette)
  { from: 337, to: 195 },  // Mozzarella bufala
  { from: 90, to: 195 },   // Gorgonzola
  { from: 140, to: 195 },  // Roquefort
]

const GLOBAL_SUB_MAP = new Map(GLOBAL_SUBSTITUTIONS.map(s => [s.from, s.to]))

// === OVERRIDES SPÉCIFIQUES (par plat) ===
// Format: {
//   dishId,
//   customName?,                                          // nom affiché à la cliente
//   removeIngredients?: [ingredientId],
//   substituteIngredients?: [{ from, to, qty?, unit? }],   // qty facultative : sinon quantité d'origine
//   addIngredients?: [{ id, qty, unit }],                  // cumulé si déjà présent dans la même unité
// }
const SPECIFIC_OVERRIDES = [
  // ═════════════════ PRINTEMPS (validé le 18/06/2026) ═════════════════

  // Salade boulgour: boulgour → quinoa
  { dishId: 286, substituteIngredients: [{ from: 190, to: 113 }] },
  // Tarte courgette/feta → Clafoutis + retirer pâte
  { dishId: 285, customName: 'Clafoutis courgette/feta', removeIngredients: [194] },
  // Tortilla asperges → Clafoutis + retirer PDT
  { dishId: 296, customName: "Clafoutis d'asperges vertes", removeIngredients: [103] },
  // Tortilla épinards → Clafoutis + retirer PDT
  { dishId: 297, customName: 'Clafoutis aux épinards', removeIngredients: [103] },
  // Courgette farcie pizza: mozza rapée → brebis (global)
  { dishId: 237 },
  // Curry courgette: riz → haricot rouge
  { dishId: 230, customName: 'Curry de courgette au chorizo & haricots rouges', substituteIngredients: [{ from: 23, to: 222 }] },
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
  // Amok: riz thaï → pois chiche
  { dishId: 274, substituteIngredients: [{ from: 97, to: 119 }] },
  // Bagel saumon: pain bagel → pain sans gluten
  { dishId: 258, substituteIngredients: [{ from: 362, to: 347 }] },
  // Bruschetta saumon: déjà au pain sans gluten, rien de spécifique
  { dishId: 272 },
  // Cabillaud miso: boulgour → quinoa
  { dishId: 280, substituteIngredients: [{ from: 190, to: 113 }] },
  // Curry crevettes patate douce (hiver/printemps): patate douce → carottes
  { dishId: 210, substituteIngredients: [{ from: 92, to: 30 }] },
  // Lasagne saumon courgette: retirer la pâte à lasagne
  { dishId: 270, removeIngredients: [227] },
  // Quiche saumon boursin → Clafoutis, retirer la pâte
  { dishId: 259, customName: 'Clafoutis au saumon fumé, boursin & asperge verte', removeIngredients: [194] },
  // Salade asiatique: vermicelle chinois → tagliatelle konjac
  { dishId: 263, substituteIngredients: [{ from: 411, to: 291 }] },
  // Salade tahitienne: riz thaï → perles de konjac
  { dishId: 262, customName: 'Salade tahitienne au saumon & konjac', substituteIngredients: [{ from: 97, to: 415 }] },
  // Saumon en croûte: PDT → chou-fleur
  { dishId: 261, substituteIngredients: [{ from: 103, to: 220 }] },
  // Boulettes lentilles: retirer la patate douce
  { dishId: 303, removeIngredients: [92] },
  // Chow mein boeuf / porc / poulet / légumes: nouilles → tagliatelle konjac
  { dishId: 128, substituteIngredients: [{ from: 77, to: 291 }] },
  { dishId: 158, substituteIngredients: [{ from: 132, to: 291 }] },
  { dishId: 136, substituteIngredients: [{ from: 77, to: 291 }] },
  { dishId: 179, substituteIngredients: [{ from: 224, to: 291 }] },
  // Feuilleté chèvre/miel: pâte feuilletée → pain sans gluten
  { dishId: 288, substituteIngredients: [{ from: 225, to: 347 }] },
  // Mujadara: riz complet → perles de konjac
  { dishId: 284, customName: 'Mujadara au konjac', substituteIngredients: [{ from: 331, to: 415 }] },
  // Pad thaï tofu: nouille de riz → tagliatelle konjac
  { dishId: 290, substituteIngredients: [{ from: 108, to: 291 }] },
  // Risottos: riz à risotto → perles de konjac (fromages traités en global)
  { dishId: 295, customName: 'Risotto de konjac aux asperges', substituteIngredients: [{ from: 217, to: 415 }] },
  { dishId: 299, customName: 'Risotto de konjac à la milanaise', substituteIngredients: [{ from: 217, to: 415 }] },
  { dishId: 175, customName: 'Risotto de konjac au potiron', substituteIngredients: [{ from: 217, to: 415 }] },
  { dishId: 211, customName: 'Risotto de konjac aux crevettes, butternut & champignons', substituteIngredients: [{ from: 217, to: 415 }] },
  // Kuku courgettes: farine → maïzena (global)
  { dishId: 289 },

  // ═════════════════ ÉTÉ 2026 (fichier chef du 18/08/2026) ═════════════════

  // 1. Aubergines farcies & riz : le riz devient de la courgette sautée
  { dishId: 387, customName: 'Aubergines farcies & courgette sautée', substituteIngredients: [{ from: 23, to: 31 }] },
  // 2. Cannelloni de courgettes : mozza → brebis (global)
  { dishId: 391 },
  // 3. Chimichanga bœuf : feuille de wrap → tortillas de maïs, cheddar → brebis (global)
  { dishId: 126, substituteIngredients: [{ from: 70, to: 426 }] },
  // 4. Chimichanga poulet : idem
  { dishId: 135, substituteIngredients: [{ from: 70, to: 426 }] },
  // 5. Courgettes rondes farcies : mozza → brebis (global)
  { dishId: 369 },
  // 6. CroQ Mr courgette : pain de mie → pain sans gluten, gouda → brebis (global)
  { dishId: 379, substituteIngredients: [{ from: 396, to: 347 }] },
  // 7. Cuisse de poulet à la toscane : pommes grenailles → carottes rôties
  { dishId: 373, customName: 'Cuisse de poulet à la toscane, tian de courgette & carotte rôtie', substituteIngredients: [{ from: 89, to: 30 }] },
  // 8 & 9. Enchiladas bœuf et poulet : cheddar → brebis (global)
  { dishId: 381 },
  { dishId: 382 },
  // 10. Fideuà → Tajine de poulet aux fruits de mer
  {
    dishId: 253,
    customName: 'Tajine de poulet aux fruits de mer',
    removeIngredients: [306],
    addIngredients: [{ id: 31, qty: 100, unit: 'g' }, { id: 30, qty: 100, unit: 'g' }, { id: 119, qty: 50, unit: 'g' }]
  },
  // 12. Pavé de saumon, salsa de mangue : le riz coco devient de la courgette grillée
  { dishId: 343, customName: 'Pavé de saumon grillé, salsa de mangue & courgette grillée', substituteIngredients: [{ from: 23, to: 31 }] },
  // 13. Galettes de patate douce au thon → galettes de lentilles corail
  {
    dishId: 344,
    customName: 'Galette de lentilles corail au thon, yaourt curcuma/miel & carottes râpées aux sésames',
    substituteIngredients: [{ from: 92, to: 352 }]
  },
  // 14. Lasagne saumon/crevettes/courgette : retirer la pâte, +100 g de courgette
  { dishId: 347, removeIngredients: [227], addIngredients: [{ id: 31, qty: 100, unit: 'g' }] },
  // 15. Merlu sauce curcuma : la purée de patate douce devient un houmous (pois chiches + cumin)
  {
    dishId: 350,
    customName: 'Merlu, sauce curcuma, houmous & carottes confites persan',
    removeIngredients: [92],
    addIngredients: [{ id: 119, qty: 130, unit: 'g' }, { id: 61, qty: 0, unit: 'qsp' }]
  },
  // 16. Samossas au thon : la salade de boulgour devient une salade d'avocat
  {
    dishId: 353,
    customName: "Samosa au thon, fromage frais & salade d'avocat à la tomate",
    substituteIngredients: [{ from: 190, to: 377, qty: 0.5, unit: 'pce' }]
  },
  // 17. Tortilla patate douce → clafoutis saumon, épinard & courgette
  { dishId: 354, customName: 'Clafoutis saumon, épinard & courgette', removeIngredients: [92], addIngredients: [{ id: 31, qty: 100, unit: 'g' }] },
  // 18. Tarte smash carottes & thon : yaourt → yaourt soja (global)
  { dishId: 357 },
  // 19. Quiche saumon/courgette/boursin → salade
  {
    dishId: 358,
    customName: 'Salade courgette, saumon & boursin',
    removeIngredients: [194],
    addIngredients: [{ id: 27, qty: 0.5, unit: 'pce' }, { id: 30, qty: 100, unit: 'g' }]
  },
  // 20. Tourte thon/épinard/feta → salade de concombre
  {
    dishId: 359,
    customName: 'Salade de concombre, thon & feta',
    removeIngredients: [292, 194],
    addIngredients: [{ id: 282, qty: 0.5, unit: 'pce' }, { id: 298, qty: 0.25, unit: 'pce' }]
  },
  // 21. Curry de crevettes (été) : retirer la patate douce, doubler les pois chiches (50 → 100 g)
  { dishId: 360, removeIngredients: [92], addIngredients: [{ id: 119, qty: 50, unit: 'g' }] },
  // 22. Parmentier de haddock : retirer patate douce et PDT, carottes +200 g
  { dishId: 365, removeIngredients: [92, 103], addIngredients: [{ id: 30, qty: 200, unit: 'g' }] },
  // 23. Crumble courgette/aubergine/tomate/sardines → ratatouille & œuf mimosa
  { dishId: 366, customName: 'Ratatouille & œuf mimosa aux sardines', addIngredients: [{ id: 41, qty: 1, unit: 'pce' }] },
  // 24. Pissaladière → salade de mâche, radis, betterave & hareng fumé
  {
    dishId: 367,
    customName: 'Salade de mâche, radis, betterave & hareng fumé',
    removeIngredients: [194],
    substituteIngredients: [{ from: 245, to: 412, qty: 100, unit: 'g' }]
  },
  // 25. Risotto à la milanaise : konjac 100 g + brebis 25 g (déjà couvert par les règles printemps)
  // 26. Risotto verde : riz à risotto → konjac 100 g, parmesan poudre → brebis 25 g
  { dishId: 322, substituteIngredients: [{ from: 217, to: 415, qty: 100, unit: 'g' }, { from: 212, to: 195, qty: 25, unit: 'g' }] },
  // 27. Risotto red : idem
  { dishId: 323, substituteIngredients: [{ from: 217, to: 415, qty: 100, unit: 'g' }, { from: 212, to: 195, qty: 25, unit: 'g' }] },
  // 28. Crumble de légumes d'été → ratatouille (retirer farine, beurre, parmesan)
  { dishId: 325, customName: 'Ratatouille', removeIngredients: [26, 18, 212] },
  // 29. Mafé : retirer le riz, carottes +100 g
  { dishId: 291, removeIngredients: [405], addIngredients: [{ id: 30, qty: 100, unit: 'g' }] },
  // 30. Moussaka végétarienne : lait → 20 cl de lait de soja, farine → maïzena (global), retirer le beurre, mozza → feta
  { dishId: 327, removeIngredients: [18], substituteIngredients: [{ from: 16, to: 288, qty: 200, unit: 'ml' }, { from: 175, to: 115 }] },
  // 31 & 32. Kuku aubergines et courgettes : farine → maïzena (global)
  { dishId: 328 },
  // 33. Gâteau de courgettes à la feta → clafoutis
  {
    dishId: 329,
    customName: 'Clafoutis de courgette à la feta & salade de mâche aux tomates cerises',
    removeIngredients: [26, 212, 206],
    substituteIngredients: [{ from: 16, to: 292 }]
  },
  // 34. Frittata courgette/tomates : crème → soja (global), parmesan poudre → feta
  { dishId: 330, substituteIngredients: [{ from: 212, to: 115 }] },
  // 35. Lasagne aux légumes d'été : retirer la pâte et le beurre (lait et farine en global)
  { dishId: 331, removeIngredients: [227, 18] },
  // 36. Chimichanga aux légumes → poêlée de légumes à la mexicaine
  {
    dishId: 177,
    customName: 'Poêlée de légumes à la mexicaine',
    removeIngredients: [223, 70],
    addIngredients: [{ id: 31, qty: 1, unit: 'pce' }]
  },
  // 37. Chow mein aux légumes : nouilles → tagliatelle de konjac (déjà couvert par les règles printemps)
  // 38. Dhal de lentilles : patate douce → poivron rouge 50 g, carottes +50 g (50 → 100 g)
  { dishId: 173, substituteIngredients: [{ from: 92, to: 71, qty: 50, unit: 'g' }], addIngredients: [{ id: 30, qty: 50, unit: 'g' }] },
  // 39. Galettes patate douce/sucrine → aubergines grillées à la feta
  {
    dishId: 336,
    customName: 'Aubergines grillées à la feta, sucrine aux pousses de soja & carottes',
    addIngredients: [{ id: 37, qty: 100, unit: 'g' }, { id: 115, qty: 25, unit: 'g' }]
  },
  // 40. Nasi Goreng → salade thaï (riz thaï → aubergines)
  { dishId: 300, customName: 'Salade thaï', substituteIngredients: [{ from: 97, to: 37 }] },
  // 41. Aubergines à la parmigiana : tous les fromages de vache → feta
  { dishId: 339, substituteIngredients: [{ from: 212, to: 115 }, { from: 175, to: 115 }, { from: 21, to: 115 }] },
  // 42. Falafel : l'écrasée de patate douce devient une écrasée de carotte
  { dishId: 287, customName: 'Falafel, haricots verts, écrasée de carotte & yaourt à la ciboulette', substituteIngredients: [{ from: 92, to: 30 }] },
  // 43. Salade haricots verts/sarrasin → avocat
  {
    dishId: 341,
    customName: "Salade d'haricots verts, avocat, tomate cerise & tofu",
    substituteIngredients: [{ from: 414, to: 377, qty: 0.5, unit: 'pce' }]
  },
  // 44. Filet mignon de porc : pommes grenailles → aubergines grillées
  { dishId: 386, substituteIngredients: [{ from: 89, to: 37 }] },
  // 45. Kefta de poulet : retirer le blé, pois chiches +50 g, concombre et tomate en plus
  {
    dishId: 372,
    customName: 'Kefta de poulet, salade de légumes & yaourt au cumin',
    removeIngredients: [420],
    addIngredients: [{ id: 119, qty: 50, unit: 'g' }, { id: 298, qty: 0.25, unit: 'pce' }, { id: 27, qty: 50, unit: 'g' }]
  },
  // 46. Lasagne courgette/ricotta/jambon : retirer la pâte, courgette +100 g
  { dishId: 388, removeIngredients: [227], addIngredients: [{ id: 31, qty: 100, unit: 'g' }] },
  // 47. Mijoté de poulet : semoule → perles de konjac
  { dishId: 393, substituteIngredients: [{ from: 65, to: 415 }] },
  // 48. Moussaka au bœuf : lait → soja, mozza → brebis (globaux)
  { dishId: 378 },
  // 49. Paëlla → paella de lentilles corail
  { dishId: 252, customName: 'Paella de lentilles corail', substituteIngredients: [{ from: 327, to: 352 }] },
  // 50. Poivrons farcis à la dinde : patate douce → courgette
  { dishId: 368, customName: 'Poivrons farcis à la dinde, wedges de courgette au tandoori', substituteIngredients: [{ from: 92, to: 31 }] },
  // 51. Pomme de terre farcie → salade de haricots verts
  { dishId: 370, customName: 'Salade de haricots verts', removeIngredients: [18], substituteIngredients: [{ from: 103, to: 141 }] },
  // 52. Porc au sucre → curry de porc aux légumes
  { dishId: 376, customName: 'Curry de porc aux légumes', removeIngredients: [81], substituteIngredients: [{ from: 92, to: 31 }] },
  // 53. Poulet basquaise : boulgour → carottes
  { dishId: 377, customName: 'Poulet basquaise, carottes aux fèves & petits pois', substituteIngredients: [{ from: 190, to: 30 }] },
  // 54. Poulet tikka massala : crème et yaourt → soja (globaux)
  { dishId: 134 },
  // 55. Salade César : lait → soja, parmesan → brebis (globaux)
  { dishId: 390 },
  // 56. Tomates farcies façon bolognaise : boulgour → houmous (pois chiches)
  { dishId: 389, customName: 'Tomates farcies façon bolognaise & houmous', substituteIngredients: [{ from: 190, to: 119, qty: 100, unit: 'g' }] },
  // 57. Émincé de dinde façon chili con carne : riz → courgette grillée
  { dishId: 380, customName: 'Émincé de dinde, courgette grillée au four', substituteIngredients: [{ from: 23, to: 31 }] },
  // 58. Émincé de veau à la zurichoise : rösti de PDT → rösti de courgette
  { dishId: 375, customName: 'Émincé de veau à la zurichoise & rösti de courgette', substituteIngredients: [{ from: 103, to: 31 }] },
]

// === PLATS MASQUÉS (jamais proposés) ===
const HIDDEN_DISHES = [
  242,  // CroQ Mr façon Fox food
  239,  // Filet de poulet pané, purée de pomme de terre & sauce boursin
  240,  // Hachis parmentier
  241,  // Mac & cheese crémeux au jambon
  234,  // Pinsa Romana
  233,  // Pâté de Pâques
  247,  // Tourte de boeuf façon empanadas
  235,  // Wrap épinards, feta & bacon
  194,  // Brandade de colin
  195,  // Brandade de sardines
  278,  // Tarte smash potatoes, saumon fumé & roquette   (été 2026)
  392,  // Tarte fine aux poivrons & chorizo              (été 2026)
]

async function run() {
  const cible = USER_ID === CHERCHEMONT_USER_ID ? 'Mme Cherchemont' : 'compte de test'
  console.log(`🔧 Overrides ${cible} (user_id=${USER_ID})${DRY_RUN ? '  — SIMULATION, aucune écriture' : ''}\n`)

  // 1. Tous les plats actifs, toutes saisons confondues : ses règles globales
  //    (pas de lait de vache, pas de farine…) valent aussi en automne et en hiver.
  const allDishes = await sql`
    SELECT d.id, d.name, d.seasons, array_agg(di.ingredient_id) as ingredient_ids
    FROM dishes d
    LEFT JOIN dish_ingredients di ON di.dish_id = d.id
    WHERE d.active = true
    GROUP BY d.id, d.name, d.seasons
  `

  const dishIngMap = new Map()
  allDishes.rows.forEach(d => {
    dishIngMap.set(d.id, {
      name: d.name,
      seasons: d.seasons,
      ingredientIds: (d.ingredient_ids || []).filter(Boolean)
    })
  })

  // 2. Appliquer les substitutions globales, plat par plat
  const empty = () => ({ action: 'modify', customName: null, removeIngredients: [], substituteIngredients: [], addIngredients: [] })
  const overridesMap = new Map()

  for (const [dishId, dishInfo] of dishIngMap) {
    const globalSubs = []
    for (const ingId of dishInfo.ingredientIds) {
      if (GLOBAL_SUB_MAP.has(ingId)) {
        globalSubs.push({ from_ingredient_id: ingId, to_ingredient_id: GLOBAL_SUB_MAP.get(ingId) })
      }
    }
    if (globalSubs.length > 0) {
      overridesMap.set(dishId, { ...empty(), substituteIngredients: globalSubs })
    }
  }

  // 3. Fusionner les règles spécifiques (elles l'emportent sur le global)
  const inconnus = []
  for (const spec of SPECIFIC_OVERRIDES) {
    if (!dishIngMap.has(spec.dishId)) {
      inconnus.push(spec.dishId)
      continue
    }
    const existing = overridesMap.get(spec.dishId) || empty()

    if (spec.customName) existing.customName = spec.customName

    for (const ingId of spec.removeIngredients || []) {
      if (!existing.removeIngredients.some(r => r.ingredient_id === ingId)) {
        existing.removeIngredients.push({ ingredient_id: ingId })
      }
      // Un ingrédient retiré ne doit plus être substitué par une règle globale
      existing.substituteIngredients = existing.substituteIngredients.filter(s => s.from_ingredient_id !== ingId)
    }

    for (const sub of spec.substituteIngredients || []) {
      existing.substituteIngredients = existing.substituteIngredients.filter(s => s.from_ingredient_id !== sub.from)
      const entry = { from_ingredient_id: sub.from, to_ingredient_id: sub.to }
      if (sub.qty != null) {
        entry.quantity = sub.qty
        entry.unit = sub.unit ?? null
      }
      existing.substituteIngredients.push(entry)
    }

    for (const add of spec.addIngredients || []) {
      existing.addIngredients.push({ ingredient_id: add.id, quantity: add.qty, unit: add.unit ?? null })
    }

    overridesMap.set(spec.dishId, existing)
  }

  // 4. Plats masqués
  for (const dishId of HIDDEN_DISHES) {
    overridesMap.set(dishId, { ...empty(), action: 'hide' })
  }

  if (inconnus.length > 0) {
    console.log(`⚠️  Plats introuvables ou inactifs, ignorés : ${inconnus.join(', ')}\n`)
  }

  // 5. Simulation : on montre ce qui serait écrit, sans rien toucher
  if (DRY_RUN) {
    const ingResult = await sql`SELECT id, name FROM ingredients`
    const ingNames = new Map(ingResult.rows.map(r => [r.id, r.name]))
    const nom = id => ingNames.get(id) || `#${id}`
    let hide = 0

    const ordonnes = [...overridesMap].sort((a, b) =>
      (dishIngMap.get(a[0])?.name || '').localeCompare(dishIngMap.get(b[0])?.name || '', 'fr'))

    for (const [dishId, ov] of ordonnes) {
      const info = dishIngMap.get(dishId)
      if (ov.action === 'hide') {
        hide++
        console.log(`🚫 [${dishId}] ${info?.name || '?'}`)
        continue
      }
      console.log(`✏️  [${dishId}] ${info?.name || '?'} ${JSON.stringify(info?.seasons || [])}`)
      if (ov.customName) console.log(`      → « ${ov.customName} »`)
      ov.removeIngredients.forEach(r => console.log(`      − ${nom(r.ingredient_id)}`))
      ov.substituteIngredients.forEach(s => console.log(`      ↻ ${nom(s.from_ingredient_id)} → ${nom(s.to_ingredient_id)}${s.quantity != null ? ` (${s.quantity} ${s.unit || ''})` : ''}`))
      ov.addIngredients.forEach(a => console.log(`      ✚ ${nom(a.ingredient_id)} ${a.quantity} ${a.unit || ''}`))
    }
    console.log(`\n📊 ${overridesMap.size} overrides (${overridesMap.size - hide} modifications, ${hide} masquages) — rien n'a été écrit.`)
    process.exit(0)
  }

  // 6. Remplacer les anciens overrides
  await sql`DELETE FROM user_dish_overrides WHERE user_id = ${USER_ID}`
  console.log('🗑️  Anciens overrides supprimés')

  let modifyCount = 0
  let hideCount = 0
  for (const [dishId, override] of overridesMap) {
    await sql`
      INSERT INTO user_dish_overrides (user_id, dish_id, action, custom_name, remove_ingredients, substitute_ingredients, add_ingredients)
      VALUES (
        ${USER_ID},
        ${dishId},
        ${override.action},
        ${override.customName},
        ${JSON.stringify(override.removeIngredients)}::jsonb,
        ${JSON.stringify(override.substituteIngredients)}::jsonb,
        ${JSON.stringify(override.addIngredients)}::jsonb
      )
    `
    if (override.action === 'hide') hideCount++
    else modifyCount++
  }

  console.log(`\n✅ ${modifyCount + hideCount} overrides insérés (${modifyCount} modifications, ${hideCount} masquages)`)

  const check = await sql`SELECT COUNT(*) as total FROM user_dish_overrides WHERE user_id = ${USER_ID}`
  console.log(`📊 Vérification: ${check.rows[0].total} overrides en base`)

  process.exit(0)
}

run().catch(e => { console.error('❌', e.message); process.exit(1) })

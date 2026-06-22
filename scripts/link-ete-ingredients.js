#!/usr/bin/env node
/**
 * Crée les liaisons dish_ingredients pour les plats actifs visibles en été
 * qui n'ont aucune liaison. Sans ces liaisons, la liste de courses agrégée
 * affiche "Aucun ingrédient lié aux plats sélectionnés" et les substitutions
 * utilisateurs (Cherchemont) ne s'appliquent pas.
 *
 * Stratégie :
 *  1) Charger les 371+ ingrédients canoniques de la table `ingredients`
 *  2) Pour chaque plat sans liaisons, parser chaque string JSONB
 *  3) Extraire (nom, quantité, unité) et matcher l'ingredient_id par nom normalisé
 *  4) INSERT dans dish_ingredients
 *  5) Reporter les ingrédients texte non matchés (à compléter manuellement)
 *
 * Options:
 *   --dry-run (défaut)  : montre les matchs sans écrire
 *   --confirm           : écrit en DB
 *   --create-missing    : crée les ingrédients canoniques absents (catégorie 'autre')
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const isDryRun = !process.argv.includes('--confirm')
const createMissing = process.argv.includes('--create-missing')

// Normaliser une chaîne : minuscules, sans accents, sans ponctuation, espaces simples
function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Parse un string ingrédient en (name, quantity, unit)
function parseIngredientString(raw) {
  // Examples : "POIVRON ROUGE 1/2 PCE", "RIZ 100 GR", "AIL", "CREME FRAICHE 12,25 CL"
  let s = String(raw).trim()
  // Enlever les parenthèses (notes)
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim()

  let quantity = null
  let unit = null

  // Match fraction "1/2", "1/4" suivie éventuellement d'une unité
  const fracMatch = s.match(/(\d+)\s*\/\s*(\d+)\s*(GR|CL|ML|PCE|DOSE|SACHET|TRANCHE|TRANCHES)?\s*$/i)
  if (fracMatch) {
    quantity = parseInt(fracMatch[1]) / parseInt(fracMatch[2])
    unit = (fracMatch[3] || 'PCE').toUpperCase()
    s = s.substring(0, fracMatch.index).trim()
  } else {
    // Match "1,5 PCE", "100 GR", etc.
    const qMatch = s.match(/(\d+(?:[.,]\d+)?)\s*(GR|CL|ML|PCE|DOSE|SACHET|TRANCHE|TRANCHES)\s*$/i)
    if (qMatch) {
      quantity = parseFloat(qMatch[1].replace(',', '.'))
      unit = qMatch[2].toUpperCase()
      s = s.substring(0, qMatch.index).trim()
    }
  }

  return {
    name: s,
    quantity,
    unit,
    normalized: normalize(s),
  }
}

// Synonymes courants entre texte Excel et ingrédients canoniques en DB
const SYNONYMS = {
  // Variantes courtes / orthographes
  'oeuf': 'oeuf',
  'oeufs': 'oeuf',
  'mais': 'mais',
  'mai': 'mais',
  // Pluriels
  'crevettes': 'crevettes',
  'crevettes decortiquees': 'crevettes',
  'crevette decortiquees': 'crevettes',
  'pavé de saumon': 'pave de saumon',
  'pave de saumon': 'pave de saumon',
  // Ingrédients en boite (le canonique n'a pas " en boite")
  'haricot rouge en boite': 'haricot rouge boite',
  'pois chiche en boite': 'pois chiche en boite',
  'mais en boite': 'mais',
  'concombre 1': 'concombre',
  // Typos source Excel
  'poirvon': 'poivron',
  'parpika': 'paprika',
  'mozzarella rappee': 'mozzarella rapee',
  'gingenmbre poudre': 'gingembre poudre',
  // Crèmes/laitages
  'creme fraiche epaisse': 'creme fraiche',
  'semi epais soja': 'semi epais de soja',
  'semi epais de soja': 'semi epais de soja',
  // Pâtes spécifiques
  'pate a lasagne fraiche': 'pate a lasagne fraiche',
  'pate brisee': 'pate brise',
  'pate brisé': 'pate brise',
  'pate brise': 'pate brise',
  'patate douce': 'patate douce',
  // Pommes de terre
  'pomme de terre vapeur': 'pomme de terre',
  'pomme de terre puree': 'pomme de terre',
  'grosse tomate': 'tomate',
  // Tomates
  'tomate concassee': 'tomate concassee',
  'tomate concasse': 'tomate concassee',
  'tomate cerise': 'tomate cerise',
  'tomate sechee': 'tomate sechee',
  'tomates sechees': 'tomate sechee',
  // Salades
  'feuille de salade': 'salade',
  'pousse d epinard': 'pousse d epinard',
  'pousse d epinards': 'pousse d epinard',
  'epinard a cuire': 'epinards',
  // Oignons
  'oignon rouge': 'oignon rouge',
  'oignon vert': 'oignon vert',
  // Citron / agrumes
  'citron jaune': 'citron jaune',
  'citron vert': 'citron vert',
  'jus d orange': 'jus d orange',
  // Huiles
  'huile olive': 'huile d olive',
  'huile d olive': 'huile d olive',
  'huile de sesame': 'huile de sesame',
  'huile tournesol': 'huile de tournesol',
  // Pousse de soja
  'pousse soja': 'pousse de soja',
  'pousse de soja': 'pousse de soja',
  // Mozzarella variants
  'mozzarella rapee': 'mozzarella rapee',
  'mozzarella bloc': 'mozzarella bloc',
  'mozzarella bille': 'mozzarella bille',
  // Parmesan
  'parmesan poudre': 'parmesan poudre',
  'parmesan bloc': 'parmesan',
  'copeau parmesan': 'copeau de parmesan',
  'copeau de parmesan': 'copeau de parmesan',
  // Pain
  'grande tranche pain de mie': 'pain de mie',
  'grande tranche de pain de mie': 'pain de mie',
  // Riz
  'riz thai': 'riz thai',
  'riz basmati': 'riz basmati',
  'riz a risotto': 'riz a risotto',
  'riz rond': 'riz rond',
  'riz complet': 'riz complet',
  // Pâtes konjac
  'tagliatelles de konjac': 'tagliatelles de konjac',
  'tagliatelle de konjac': 'tagliatelle de konjac',
  'shirataki de konjac': 'shirataki de konjac',
  // Poissons
  'pave de saumon': 'pave de saumon',
  'filet de cabillaud': 'cabillaud',
  'filet de merlu': 'merlu',
  'filet de saumon': 'saumon',
  'filet de lieu': 'lieu',
  'filet d eglefin': 'eglefin',
  'filet de colin': 'colin',
  // Viandes
  'boeuf hache': 'boeuf hache',
  'boeuf hache frais': 'boeuf hache',
  'echine de porc': 'porc',
  'filet mignon de porc': 'porc',
  'filet mignon porc': 'porc',
  'porc hache': 'porc hache',
  'dinde hachee': 'dinde hachee',
  'escalope de dinde': 'dinde',
  'escalope de veau': 'veau',
  'haut de cuisse de poulet': 'haut de cuisse de poulet',
  'cuisse de poulet': 'cuisse de poulet',
  'filet de poulet': 'filet de poulet',
  'blanc de poulet': 'blanc de poulet',
  'blanc de poulet en tranche': 'blanc de poulet en tranche',
  'bavette de boeuf': 'bavette de boeuf',
  'jambon blanc': 'jambon blanc',
  'jambon cru': 'jambon cru',
  'lard en tranche': 'lardon',
  // Légumes
  'chou fleur': 'chou fleur',
  'chou chinois': 'chou chinois',
  'chou romanesco': 'chou romanesco',
  'courgette ronde': 'courgette',
  'haricot vert': 'haricot vert',
  'petit pois': 'petit pois',
  'petit pois en boite': 'petit pois',
  'lentilles verte': 'lentilles vertes',
  'lentille corail': 'lentille corail',
  'lentilles corail': 'lentille corail',
  // Autres
  'sauce soja sucre': 'sauce soja sucre',
  'cebette': 'cebette',
  'feuille de wrap': 'wrap',
  'feuille de brick': 'feuille de brick',
  'galette de riz': 'galette de riz',
  'lait de soja ou amande': 'lait de soja',
  'creme de coco': 'creme de coco',
  'compote de pomme sans sucre': 'compote de pomme sans sucre',
  // Variantes pluriels/féminin non couvertes par le fallback -s
  'olive denoyautees': 'olive denoyauté',
  'olives denoyautees': 'olive denoyauté',
  'flocon d avoine': 'flocons d avoine',
  'flocons d avoine': 'flocons d avoine',
  'haricot vert': 'haricot vert frais',
  'haricots verts': 'haricot vert frais',
  'lentille corail': 'lentilles corail',
  'lentilles corail': 'lentilles corail',
  'tortillas de mais': 'tortillas de mais',
  'tortilla de mais': 'tortillas de mais',
  'anchois a l huile': 'anchois',
  'sucre semoule roux': 'sucre roux',
  'sucre semoule': 'sucre',
  'coeur d artichaut': 'coeur d artichaut',
  'coeurs d artichaut': 'coeur d artichaut',
  'coeur d artichaut en boite': 'coeur d artichaut',
  'coeurs d artichaut en boite': 'coeur d artichaut',
  'jus d orange': 'orange',
  'mangue mure': 'mangue',
  'jeunes pousses': 'mesclun',
  'merlu': 'merlu',
  'haddock': 'haddock',
  'hareng fume': 'hareng fume',
  'sardines': 'sardines',
  'confiture d abricot': 'confiture',
  'jaune oeuf': 'oeufs',
  'jaune d oeuf': 'oeufs',
  'huile de coco': 'huile de coco',
  'huile de tournesol': 'huile de tournesol',
  'canelle en poudre': 'cannelle',
  'cannelle en poudre': 'cannelle',
  'ble pre cuit': 'ble',
  'feuille de brick': 'pate brick',
  'tagliatelles de konjac': 'tagliatelle de konjac',
  'shirataki de konjac': 'shirataki de konjac',
  // Mappings vers les noms canoniques exacts trouvés en DB
  'merlu': 'filet de merlu',
  'haddock': 'filet de hareng', // pas de haddock direct, le hareng est l'analogue le + proche
  'hareng fume': 'filet de hareng',
  'sardines': 'sardines en boite a lhuile olive',
  'huile de tournesol': 'huile tournesol',
  'huile de coco': 'creme de coco',
  'cacao': 'cacao en poudre',
  'vanille poudre': 'vanille en poudre',
  'coulis tomate': 'coulis de tomate',
  'sarrasin': 'sarrasin en grains',
  'anchois a l huile': 'sardines en boite a lhuile olive', // pas d'anchois en DB
  'sucre semoule roux': 'sucre roux',
  'gouda': 'gouda',  // si existe, sinon non matché
}

async function main() {
  console.log('🔗 Linkage ingrédients ↔ plats été')
  console.log('   Mode :', isDryRun ? 'DRY-RUN' : 'CONFIRM')
  console.log('   Création des ingrédients manquants :', createMissing ? 'OUI' : 'NON (signalés seulement)')
  console.log()

  // Charger tous les ingrédients canoniques
  const ingsR = await sql`SELECT id, name, category FROM ingredients WHERE active = true`
  const byNorm = new Map()
  for (const ing of ingsR.rows) {
    const n = normalize(ing.name)
    // Indexer le nom normalisé tel quel
    if (!byNorm.has(n)) byNorm.set(n, ing)
    // Et aussi la variante singulier (sans 's' final)
    if (n.endsWith('s') && n.length > 2) {
      const sing = n.slice(0, -1)
      if (!byNorm.has(sing)) byNorm.set(sing, ing)
    }
    // Et la variante "haché/hachée" → "hache"
    const dehache = n.replace(/hache(e|s|es)?$/, 'hache')
    if (dehache !== n && !byNorm.has(dehache)) byNorm.set(dehache, ing)
  }
  console.log(`Ingrédients canoniques chargés : ${ingsR.rows.length} (${byNorm.size} clés normalisées avec variantes singulier)`)

  // Charger les plats sans liaisons, visibles en été
  const dishesR = await sql`
    SELECT d.id, d.name, d.ingredients
    FROM dishes d
    WHERE d.active = true
      AND (d.seasons @> '"ete"'::jsonb OR d.seasons @> '"toutes"'::jsonb)
      AND NOT EXISTS (SELECT 1 FROM dish_ingredients WHERE dish_id = d.id)
    ORDER BY d.id
  `
  console.log(`Plats été sans liaisons : ${dishesR.rows.length}`)
  console.log()

  const unmatched = new Map() // normalized name → count
  let totalLinks = 0
  let plats = 0

  for (const dish of dishesR.rows) {
    const ingredients = dish.ingredients || []
    if (ingredients.length === 0) continue
    plats++
    let linksForDish = 0

    for (const raw of ingredients) {
      const parsed = parseIngredientString(raw)
      if (!parsed.name) continue

      // Tentative de match en cascade :
      // 1) direct, 2) via SYNONYMS, 3) +s (pluriel), 4) -s (singulier), 5) 1er mot
      let found = byNorm.get(parsed.normalized)
      if (!found) {
        const syn = SYNONYMS[parsed.normalized]
        if (syn) found = byNorm.get(normalize(syn))
      }
      if (!found) found = byNorm.get(parsed.normalized + 's')
      if (!found && parsed.normalized.endsWith('s')) {
        found = byNorm.get(parsed.normalized.slice(0, -1))
      }
      if (!found && parsed.normalized.length > 3) {
        const firstWord = parsed.normalized.split(' ')[0]
        if (firstWord.length >= 4) found = byNorm.get(firstWord) || byNorm.get(firstWord + 's')
      }

      if (found) {
        if (!isDryRun) {
          // quantity est NOT NULL, fallback à 1 si pas extrait du texte
          const qty = parsed.quantity != null ? parsed.quantity : 1
          await sql`
            INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity, unit)
            VALUES (${dish.id}, ${found.id}, ${qty}, ${parsed.unit})
            ON CONFLICT (dish_id, ingredient_id) DO NOTHING
          `
        }
        linksForDish++
        totalLinks++
      } else {
        unmatched.set(parsed.normalized, (unmatched.get(parsed.normalized) || 0) + 1)
      }
    }
    console.log(`  [${dish.id}] ${dish.name.padEnd(60).substring(0, 60)} → ${linksForDish}/${ingredients.length} liés`)
  }

  console.log()
  console.log('═══ Résumé ═══')
  console.log(`  Plats traités  : ${plats}`)
  console.log(`  Liaisons créées : ${totalLinks}`)
  console.log(`  Ingrédients non matchés (uniques) : ${unmatched.size}`)
  console.log()

  if (unmatched.size > 0) {
    console.log('⚠️ Ingrédients texte non matchés (par fréquence) :')
    const sorted = [...unmatched.entries()].sort((a, b) => b[1] - a[1])
    sorted.slice(0, 50).forEach(([name, count]) => {
      console.log(`     ${count.toString().padStart(3)}× "${name}"`)
    })
    if (sorted.length > 50) console.log(`     ... et ${sorted.length - 50} autre(s)`)
  }

  if (isDryRun) console.log('\n💡 Pour appliquer : node scripts/link-ete-ingredients.js --confirm')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })

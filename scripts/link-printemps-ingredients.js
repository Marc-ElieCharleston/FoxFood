#!/usr/bin/env node
/**
 * Script pour lier les ingrédients JSONB bruts des plats printemps
 * dans la table dish_ingredients en matchant/créant les ingrédients
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

// Mapping manuel des noms JSONB → nom en base (ou nom à créer)
const NAME_ALIASES = {
  'CAROTTE': 'Carottes',
  'COURGETTE': 'Courgettes',
  'OIGNON': 'Oignons',
  'CONCOMBRE': 'Concombre',
  'TOMATE': 'Tomate',
  'TOMATE CERISE': 'Tomate cerise',
  'TOMATE SECHE': 'Tomate sechee',
  'OEUF': 'Oeufs',
  'OEUFS': 'Oeufs',
  'POIVRON': 'Poivron',
  'POIVRON ROUGE': 'Poivron rouge',
  'POIVRON VERT': 'Poivron vert',
  'POIVRON JAUNE': 'Poivron jaune',
  'PETIT POIS': 'Petit pois',
  'HARICOT VERT': 'Haricots verts',
  'ASPERGE VERTE': 'Asperge verte',
  'ASPERGES VERTES': 'Asperge verte',
  'LARDON': 'Lardons',
  'BACON': 'Bacon',
  'PESTO': 'Pesto',
  'MENTHE': 'Menthe',
  'MENTHE FRAICHE': 'Menthe fraiche',
  'BASILIC': 'Basilic',
  'BASILIC FRAIS': 'Basilic frais',
  'CORIANDRE POUDRE': 'Coriandre en poudre',
  'SUCRE POUDRE': 'Sucre en poudre',
  'SUCRE EN POUDRE': 'Sucre en poudre',
  'SUCRE DE CANNE POUDRE': 'Sucre de canne en poudre',
  'HERBES DE PROVENCE': 'Herbes de Provence',
  'FILET DE POULET': 'Filet de poulet',
  'BLANC DE POULET': 'Blanc de poulet',
  'BLANC DE POULET EN TRANCHE': 'Blanc de poulet en tranche',
  'FILET DE CABILLAUD': 'Filet de cabillaud',
  'FILET DE SAUMON': 'Filet de saumon',
  'PAVE DE SAUMON': 'Pave de saumon',
  'FILET DE MERLU': 'Filet de merlu',
  'FILET DE LIEU': 'Filet de lieu',
  'FILET DE HARENG': 'Filet de hareng',
  'FILET D\'EGLEFIN': 'Filet d\'eglefin',
  'FILET MIGNON PORC': 'Filet mignon de porc',
  'BOEUF HACHE FRAIS': 'Boeuf hache',
  'CREVETTE': 'Crevettes',
  'CREVETTE DECORTIQUEE': 'Crevettes decortiquees',
  'CREVETTES DECORTIQUEES': 'Crevettes decortiquees',
  'SAUMON FUME TRANCHE': 'Saumon fume tranche',
  'TRUITE FUME TRANCHE': 'Truite fumee tranche',
  'JAMBON CRU': 'Jambon cru',
  'JAMBON CRU TRANCHE': 'Jambon cru tranche',
  'MOZZARELLA BILLE': 'Mozzarella bille',
  'MOZZARELLA BUFFALA': 'Mozzarella bufala',
  'COPEAU PARMESAN': 'Copeau de parmesan',
  'PATE BRISEE': 'Pate brise',
  'PATE BRISE': 'Pate brise',
  'PATE FEUILLETEE': 'Pate feuillete',
  'PATE FEUILLETE': 'Pate feuillete',
  'PATE A LASAGNE': 'Pate a lasagne fraiche',
  'PATE FUSILLI': 'Fusilli',
  'PATE FIDEUA': 'Pate fideua',
  'COQUILLETTE': 'Coquillettes',
  'GALETTE DE RIZ': 'Galette de riz',
  'VERMICELLE DE RIZ': 'Vermicelle de riz',
  'VERMICELLE CHINOIS': 'Vermicelle chinois',
  'NOUILLES DE RIZ': 'Nouille de riz',
  'RIZ BASMATI': 'Riz basmati',
  'RIZ COMPLET': 'Riz complet',
  'RIZ ROND': 'Riz rond',
  'LENTILLES VERTES': 'Lentilles vertes',
  'LENTILLES CORAIL': 'Lentilles corail',
  'HARICOT ROUGE EN BOITE': 'Haricot rouge en boite',
  'HARICOT MUNGO': 'Haricot mungo',
  'POIS CHICHE': 'Pois chiche',
  'POIS CHICHE EN BOITE': 'Pois chiche en boite',
  'TOFU FERME': 'Tofu ferme',
  'FLOCON D\'AVOINE': 'Flocons d\'avoine',
  'FLOCONS D\'AVOINE': 'Flocons d\'avoine',
  'POUSSE D\'EPINARD': 'Pousse d\'epinard',
  'POUSSE D\'EPINARDS': 'Pousse d\'epinard',
  'NOIX DE COCO RAPEE': 'Noix de coco rapee',
  'LAIT DE SOJA OU AMANDE': 'Lait de soja',
  'SEMI EPAIS SOJA': 'Semi épais de soja',
  'SEMI EPAIS DE SOJA': 'Semi épais de soja',
  'YAOURT SOJA': 'Yaourt au soja',
  'YAOURT GREC': 'Yaourt grec',
  'YAOURT GRECQUE': 'Yaourt grec',
  'YAOURT SKYR': 'Yaourt skyr',
  'CONCASSEE DE TOMATE': 'Concassee de tomate',
  'SAUCE TOMATE PIZZA': 'Sauce tomate pizza',
  'KONJAC': 'Tagliatelle de konjac',
  'MAIS': 'Mais',
  'FEVES': 'Feves',
  'OIGNON ROUGE': 'Oignon rouge',
  'CEBETTE': 'Cebette',
  'RADIS ROSE': 'Radis rose',
  'PAK CHOI': 'Pak choi',
  'AVOCAT': 'Avocat',
  'BANANE': 'Banane',
  'KIWI': 'Kiwi',
  'ORANGE': 'Orange',
  'ANANAS': 'Ananas',
  'POMELOS': 'Pomelos',
  'POMME VERTE': 'Pomme verte',
  'GRENADE': 'Grenade',
  'FRUIT DE LA PASSION': 'Fruit de la passion',
  'CHOCOLAT': 'Chocolat noir',
  'PEPITES DE CHOCOLAT': 'Pepites de chocolat',
  'CACAO POUDRE': 'Cacao en poudre',
  'POUDRE D\'AMANDE': 'Poudre d\'amande',
  'CACAHOUETES': 'Cacahouetes',
  'BEURRE DE CACAHOUETES': 'Beurre de cacahouetes',
  'PISTACHE': 'Pistache',
  'PIGNON PIN': 'Pignon de pin',
  'SESAME GRAINES': 'Graines de sesame',
  'GRAINES DE PAVOT': 'Graines de pavot',
  'COMPOTE DE POMME SANS SUCRE': 'Compote de pomme sans sucre',
  'CREME DE COCO': 'Creme de coco',
  'VANILLE POUDRE': 'Vanille en poudre',
  'POUDRE A SAFRAN': 'Safran en poudre',
  'TANDOORI': 'Tandoori',
  'MISO': 'Miso',
  'RILLETTE DE CRABE': 'Rillette de crabe',
  'LAMELLES D\'ENCORNET': 'Lamelles d\'encornet',
  'MELANGE FRUITS DE MER': 'Melange fruits de mer',
  'VIANDE DES GRISONS': 'Viande des Grisons',
  'SAUCE SOJA SUCRE': 'Sauce soja sucree',
  'SAUCE HUITRE': 'Sauce huitre',
  'SAUCE POISSON': 'Sauce poisson',
  'SAUCE SRIRACHA': 'Sauce sriracha',
  'PATE DE CREVETTE': 'Pate de crevette',
  'PATE DE TAMARIN': 'Pate de tamarin',
  'VINAIGRE DE VIN ROUGE': 'Vinaigre de vin rouge',
  'JUS DE CITRON': 'Jus de citron',
  'CITRON': 'Citron',
  'CITRONELLE': 'Citronnelle',
  'GINGEMBRE': 'Gingembre frais',
  'LAURIER': 'Laurier',
  'CORNICHON': 'Cornichon',
  'POMME DE TERRE PUREE': 'Pomme de terre',
  'PAIN BAGEL': 'Pain bagel',
  'PAIN SANS GLUTEN': 'Pain sans gluten',
  'PINSA PATE': 'Pate a pinsa',
  'GRANDE TRANCHE DE PAIN DE MIE': 'Pain de mie',
  'FROMAGE A BURGER TRANCHE': 'Fromage a burger',
  'SPAGHETTI QUINOA TOMATE': 'Spaghetti quinoa tomate',
  'EPICES ITALIENNE': 'Epices italiennes',
  'EPICES MEXICAINES': 'Epices mexicaines',
  'FEUILLE DE MENTHE': 'Feuille de menthe',
  'FEUILLE DE SALADE': 'Feuille de salade',
  'PAPIER A PAPILLOTE': 'Papier a papillote',
  'HUILE OLIVE BIO': 'Huile d\'olive',
}

// Catégorie par défaut pour les nouveaux ingrédients
const CATEGORY_MAP = {
  // Viandes
  'Blanc de poulet': 'viande', 'Blanc de poulet en tranche': 'viande', 'Filet de poulet': 'viande',
  'Boeuf hache': 'viande', 'Filet mignon de porc': 'viande', 'Bacon': 'viande', 'Lardons': 'viande',
  'Jambon cru': 'viande', 'Jambon cru tranche': 'viande', 'Viande des Grisons': 'viande',
  // Poissons
  'Filet de cabillaud': 'poisson', 'Filet de saumon': 'poisson', 'Pave de saumon': 'poisson',
  'Filet de merlu': 'poisson', 'Filet de lieu': 'poisson', 'Filet de hareng': 'poisson',
  'Filet d\'eglefin': 'poisson', 'Crevettes': 'poisson', 'Crevettes decortiquees': 'poisson',
  'Saumon fume tranche': 'poisson', 'Truite fumee tranche': 'poisson', 'Rillette de crabe': 'poisson',
  'Lamelles d\'encornet': 'poisson', 'Melange fruits de mer': 'poisson',
  // Produits laitiers
  'Mozzarella bille': 'produit_laitier', 'Mozzarella bufala': 'produit_laitier',
  'Copeau de parmesan': 'produit_laitier', 'Yaourt grec': 'produit_laitier',
  'Yaourt skyr': 'produit_laitier', 'Creme de coco': 'produit_laitier', 'Fromage a burger': 'produit_laitier',
  // Féculents
  'Riz basmati': 'feculent', 'Riz complet': 'feculent', 'Riz rond': 'feculent',
  'Coquillettes': 'feculent', 'Fusilli': 'feculent', 'Galette de riz': 'feculent',
  'Vermicelle de riz': 'feculent', 'Vermicelle chinois': 'feculent', 'Pate fideua': 'feculent',
  'Pain bagel': 'feculent', 'Pain sans gluten': 'feculent', 'Pain de mie': 'feculent',
  'Pate a pinsa': 'feculent', 'Lentilles vertes': 'feculent', 'Lentilles corail': 'feculent',
  'Haricot rouge en boite': 'feculent', 'Haricot mungo': 'feculent', 'Spaghetti quinoa tomate': 'feculent',
  'Pois chiche en boite': 'feculent',
  // Légumes
  'Asperge verte': 'legume', 'Concombre': 'legume', 'Tomate': 'legume', 'Tomate cerise': 'legume',
  'Radis rose': 'legume', 'Pak choi': 'legume', 'Oignon rouge': 'legume', 'Cebette': 'legume',
  'Mais': 'legume', 'Feves': 'legume', 'Avocat': 'legume',
  // Fruits
  'Banane': 'fruit', 'Kiwi': 'fruit', 'Orange': 'fruit', 'Ananas': 'fruit',
  'Pomelos': 'fruit', 'Pomme verte': 'fruit', 'Grenade': 'fruit', 'Fruit de la passion': 'fruit',
  // Épices/condiments
  'Tandoori': 'epice', 'Miso': 'epice', 'Vanille en poudre': 'epice', 'Safran en poudre': 'epice',
  'Epices italiennes': 'epice', 'Epices mexicaines': 'epice', 'Laurier': 'epice',
  'Citronnelle': 'epice', 'Herbes de Provence': 'epice', 'Cacao en poudre': 'epice',
  'Sauce soja sucree': 'condiment', 'Sauce huitre': 'condiment', 'Sauce poisson': 'condiment',
  'Sauce sriracha': 'condiment', 'Sauce tomate pizza': 'condiment', 'Pate de crevette': 'condiment',
  'Pate de tamarin': 'condiment', 'Vinaigre de vin rouge': 'condiment', 'Jus de citron': 'condiment',
  // Autres
  'Chocolat noir': 'autre', 'Pepites de chocolat': 'autre', 'Compote de pomme sans sucre': 'autre',
  'Sucre en poudre': 'autre', 'Sucre de canne en poudre': 'autre',
  'Papier a papillote': 'autre',
}

// Unité par défaut
const UNIT_MAP = {
  'GR': 'g', 'G': 'g', 'ML': 'ml', 'CL': 'cl',
  'PCE': 'pce', 'TRANCHE': 'tranche', 'TRANCHES': 'tranche',
  'SACHET': 'sachet', 'DOSE': 'dose',
}

function parseIngredient(raw) {
  // Patterns: "NOM QTY UNIT", "NOM QTY/FRAC UNIT", "NOM"
  const match = raw.match(/^(.+?)\s+([\d,./]+)\s*(GR|G|ML|CL|PCE|TRANCHE|TRANCHES|SACHET|DOSE)\s*$/i)
  if (match) {
    let qty = match[2].replace(',', '.')
    if (qty.includes('/')) {
      const [num, den] = qty.split('/')
      qty = parseFloat(num) / parseFloat(den)
    } else {
      qty = parseFloat(qty)
    }
    return { name: match[1].trim(), quantity: qty || 0, unit: UNIT_MAP[match[3].toUpperCase()] || 'g' }
  }
  // Try "NOM QTY" without unit
  const match2 = raw.match(/^(.+?)\s+([\d,./]+)\s*$/)
  if (match2) {
    let qty = match2[2].replace(',', '.')
    return { name: match2[1].trim(), quantity: parseFloat(qty) || 0, unit: 'g' }
  }
  // Just name
  return { name: raw.trim(), quantity: 0, unit: 'qsp' }
}

async function run() {
  console.log('🔗 Liaison des ingrédients printemps dans dish_ingredients\n')

  // 1. Charger tous les ingrédients existants
  const allIngs = await sql`SELECT id, name FROM ingredients WHERE active = true`
  const ingByName = new Map()
  allIngs.rows.forEach(i => {
    ingByName.set(i.name.toLowerCase(), i)
    // Also normalize without accents
    const normalized = i.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    ingByName.set(normalized, i)
  })

  // 2. Charger les plats sans dish_ingredients
  const dishes = await sql`
    SELECT d.id, d.name, d.ingredients
    FROM dishes d
    LEFT JOIN dish_ingredients di ON di.dish_id = d.id
    WHERE d.active = true AND di.id IS NULL
    AND d.ingredients IS NOT NULL AND d.ingredients != '[]'::jsonb
  `
  console.log(`${dishes.rows.length} plats à traiter\n`)

  let totalLinked = 0
  let totalCreated = 0
  let totalSkipped = 0
  const createdIngredients = []

  for (const dish of dishes.rows) {
    let ings = dish.ingredients
    if (typeof ings === 'string') { try { ings = JSON.parse(ings) } catch { continue } }
    if (!Array.isArray(ings) || ings.length === 0) continue

    let dishLinked = 0
    for (const rawIng of ings) {
      const parsed = parseIngredient(rawIng)

      // Resolve name via alias
      const resolvedName = NAME_ALIASES[parsed.name] || parsed.name

      // Try to find ingredient in DB
      let dbIng = ingByName.get(resolvedName.toLowerCase()) ||
                  ingByName.get(resolvedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))

      // If not found, create it
      if (!dbIng) {
        const category = CATEGORY_MAP[resolvedName] || 'autre'
        const unit = parsed.unit !== 'qsp' ? parsed.unit : 'g'
        try {
          const result = await sql`
            INSERT INTO ingredients (name, category, default_unit, active, dietary_tags)
            VALUES (${resolvedName}, ${category}, ${unit}, true, '[]'::jsonb)
            RETURNING id, name
          `
          dbIng = result.rows[0]
          ingByName.set(dbIng.name.toLowerCase(), dbIng)
          createdIngredients.push(dbIng.name)
          totalCreated++
        } catch (err) {
          // Peut-être un doublon
          const existing = await sql`SELECT id, name FROM ingredients WHERE name = ${resolvedName} LIMIT 1`
          if (existing.rows.length > 0) {
            dbIng = existing.rows[0]
            ingByName.set(dbIng.name.toLowerCase(), dbIng)
          } else {
            console.log(`  ⚠️ Impossible de créer: ${resolvedName} (${err.message.substring(0, 40)})`)
            totalSkipped++
            continue
          }
        }
      }

      // Link ingredient to dish
      try {
        await sql`
          INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity, unit)
          VALUES (${dish.id}, ${dbIng.id}, ${parsed.quantity}, ${parsed.unit})
          ON CONFLICT (dish_id, ingredient_id) DO NOTHING
        `
        dishLinked++
        totalLinked++
      } catch (err) {
        totalSkipped++
      }
    }
  }

  console.log(`\n✅ Résultat:`)
  console.log(`  ${totalLinked} liaisons créées dans dish_ingredients`)
  console.log(`  ${totalCreated} nouveaux ingrédients créés`)
  console.log(`  ${totalSkipped} ignorés/erreurs`)

  if (createdIngredients.length > 0) {
    console.log(`\nNouveaux ingrédients créés:`)
    createdIngredients.sort().forEach(n => console.log(`  + ${n}`))
  }

  // Vérification finale
  const check = await sql`
    SELECT COUNT(DISTINCT d.id) as total
    FROM dishes d
    LEFT JOIN dish_ingredients di ON di.dish_id = d.id
    WHERE d.active = true AND di.id IS NULL
    AND d.ingredients IS NOT NULL AND d.ingredients != '[]'::jsonb
  `
  console.log(`\nPlats encore sans dish_ingredients: ${check.rows[0].total}`)

  process.exit(0)
}

run().catch(e => { console.error('❌ Erreur:', e.message); process.exit(1) })

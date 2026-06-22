#!/usr/bin/env node
/**
 * Génère une description courte pour chaque plat actif visible en été (ou toutes saisons)
 * qui n'en a pas. La description est dérivée du nom + 2-3 ingrédients principaux.
 *
 * Le chef peut ensuite éditer chaque description depuis /admin si le rendu ne lui convient pas.
 *
 * Options:
 *   --dry-run (défaut)  : affiche les propositions sans écrire
 *   --confirm           : écrit en DB
 *   --all-seasons       : traite tous les plats sans desc, pas seulement été
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const isDryRun = !process.argv.includes('--confirm')
const allSeasons = process.argv.includes('--all-seasons')

// Mots à ignorer quand on choisit les "ingrédients clés" d'une description
const NOISE_WORDS = new Set([
  'AIL', 'OIGNON', 'OIGNON ROUGE', 'PERSIL', 'CIBOULETTE', 'ECHALOTE',
  'CORIANDRE', 'MENTHE', 'BASILIC', 'THYM', 'ROMARIN', 'ORIGAN', 'ANETH', 'LAURIER',
  'PAPRIKA', 'PARPIKA', 'CUMIN', 'CURRY', 'CURCUMA', 'GINGEMBRE POUDRE', 'GINGENMBRE POUDRE',
  'EPICES MEXICAINES', 'HERBES DE PROVENCE', 'PIMENT D\'ESPELETTE', 'TANDOORI', 'MISO',
  'SEL', 'POIVRE', 'VANILLE POUDRE', 'CANELLE EN POUDRE', 'GRAINES DE PAVOT',
  'MIEL', 'SUCRE SEMOULE', 'SUCRE EN POUDRE', 'SUCRE POUDRE', 'SUCRE SEMOULE ROUX',
  'SAUCE SOJA', 'SAUCE HUITRE', 'SAUCE POISSON', 'SAUCE SRIRACHA', 'VINAIGRE DE VIN ROUGE',
  'VINAIGRE DE RIZ', 'VIN BLANC', 'VIN BLANC CUISINE', 'CITRON JAUNE', 'CITRON VERT',
  'HUILE OLIVE', 'HUILE DE SESAME', 'HUILE DE COCO', 'HUILE TOURNESOL', 'HUILE OLIVE BIO',
  'MOUTARDE', 'MAÏZENA', 'MAIZENA', 'CHAPELURE', 'LEVURE CHIMIQUE', 'FARINE',
  'OEUF', 'OEUFS', 'JAUNE OEUF',
  'CONCENTRE DE TOMATE', 'TOMATE CONCASSEE', 'TOMATE CONCASSE', 'COULIS TOMATE',
  'FOND DE VEAU POUDRE', 'PATE DE CREVETTE', 'PATE DE TAMARIN', 'CITRONELLE',
  'SAFRAN', 'POUDRE A SAFRAN', 'CACAO', 'PIGNON DE PIN', 'PIGNON PIN',
  'AMANDE EFFILEE', 'AMANDES EFFILEES', 'POUDRE D\'AMANDE', 'POUDRE D\'AMANDES',
  'CAPRES', 'CORNICHON',
])

// Retire la quantité d'un ingrédient (fractions d'abord pour éviter les troncatures)
function ingredientLabel(raw) {
  return raw
    // parenthèses (note du chef)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    // fractions "1/2 PCE" ou "1/4" → ""  (avant les autres car contient un /)
    .replace(/\s*\d+\s*\/\s*\d+\s*(?:GR|CL|ML|PCE|DOSE|SACHET|TRANCHE|TRANCHES)?\b/gi, '')
    // "X,Y UNIT" ou "X UNIT" → ""
    .replace(/\s*\d+(?:[.,]\d+)?\s*(?:GR|CL|ML|PCE|DOSE|SACHET|TRANCHE|TRANCHES)\b/gi, '')
    // résidus numériques en fin
    .replace(/\s+\d+(?:[.,]\d+)?\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Descriptions manuelles pour les plats sans ingrédients (recyclés/historiques)
const MANUAL_DESCRIPTIONS = {
  194: "Brandade traditionnelle de colin et pommes de terre.",
  195: "Brandade de sardines à la provençale.",
  126: "Tortilla de bœuf frite, à la mexicaine.",
  135: "Tortilla de poulet épicée, façon Tex-Mex.",
  177: "Tortilla mexicaine garnie de légumes du soleil.",
  179: "Nouilles sautées chinoises aux légumes croquants.",
  173: "Dhal indien de lentilles corail et patates douces au lait de coco.",
  134: "Poulet mariné au tikka et sauce massala onctueuse.",
  222: "Œufs durs nappés de sauce tomate épicée à l'espagnole.",
}

// Table d'accents pour rendre lisibles les labels en majuscules sans accent
const ACCENTS = [
  [/\bpate brisee\b/gi, 'pâte brisée'],
  [/\bpate feuillet[eé]e\b/gi, 'pâte feuilletée'],
  [/\bpate a lasagne fraiche\b/gi, 'pâte à lasagne'],
  [/\bpate fideua\b/gi, 'pâte fideuà'],
  [/\bpate fusilli\b/gi, 'fusilli'],
  [/\bsemi epais soja\b/gi, 'crème de soja'],
  [/\bsemi epais de soja\b/gi, 'crème de soja'],
  [/\bcreme fraiche\b/gi, 'crème fraîche'],
  [/\bcreme fraiche epaisse\b/gi, 'crème fraîche'],
  [/\bcreme de coco\b/gi, 'crème de coco'],
  [/\bsaumon fume\b/gi, 'saumon fumé'],
  [/\bhareng fume\b/gi, 'hareng fumé'],
  [/\btruite fume\b/gi, 'truite fumée'],
  [/\bviande des grisons\b/gi, 'viande des Grisons'],
  [/\bepinard a cuire\b/gi, 'épinards'],
  [/\bpousse d['’]epinard\b/gi, 'pousses d\'épinards'],
  [/\bpousse de soja\b/gi, 'pousses de soja'],
  [/\bpousse soja\b/gi, 'pousses de soja'],
  [/\bharicot mungo\b/gi, 'pousses de haricot mungo'],
  [/\bdecortiquees?\b/gi, 'décortiquées'],
  [/\bdenoyautees?\b/gi, 'dénoyautées'],
  [/\btomate sechee\b/gi, 'tomates séchées'],
  [/\btomates sechees\b/gi, 'tomates séchées'],
  [/\btomate cerise\b/gi, 'tomates cerise'],
  [/\btomate concassee\b/gi, 'tomates concassées'],
  [/\bpulpe de tomate\b/gi, 'pulpe de tomate'],
  [/\bpoivron rouge\b/gi, 'poivron rouge'],
  [/\bpoivron jaune\b/gi, 'poivron jaune'],
  [/\bpoivron vert\b/gi, 'poivron vert'],
  [/\bpoivron\b/gi, 'poivron'],
  [/\bpatate douce\b/gi, 'patate douce'],
  [/\bpomme de terre grenailles?\b/gi, 'pommes de terre grenailles'],
  [/\bpomme de terre vapeur\b/gi, 'pommes de terre vapeur'],
  [/\bpomme de terre puree\b/gi, 'pommes de terre'],
  [/\bpomme de terre\b/gi, 'pommes de terre'],
  [/\boignon rouge\b/gi, 'oignon rouge'],
  [/\boignon vert\b/gi, 'oignon vert'],
  [/\bfilet de poulet\b/gi, 'filet de poulet'],
  [/\bblanc de poulet\b/gi, 'blanc de poulet'],
  [/\bcuisse de poulet\b/gi, 'cuisse de poulet'],
  [/\bhaut de cuisse de poulet\b/gi, 'haut de cuisse de poulet'],
  [/\bescalope de dinde\b/gi, 'escalope de dinde'],
  [/\bdinde hachee\b/gi, 'dinde hachée'],
  [/\bescalope de veau\b/gi, 'escalope de veau'],
  [/\bsaute d['’]agneau\b/gi, 'sauté d\'agneau'],
  [/\bbavette de boeuf\b/gi, 'bavette de bœuf'],
  [/\bboeuf hache(\s+frais)?\b/gi, 'bœuf haché'],
  [/\bechine de porc\b/gi, 'échine de porc'],
  [/\bfilet mignon de porc\b/gi, 'filet mignon de porc'],
  [/\bfilet mignon porc\b/gi, 'filet mignon de porc'],
  [/\bporc hache\b/gi, 'porc haché'],
  [/\bbacon\b/gi, 'bacon'],
  [/\bjambon blanc\b/gi, 'jambon blanc'],
  [/\bjambon cru\b/gi, 'jambon cru'],
  [/\blardon\b/gi, 'lardons'],
  [/\blard en tranche\b/gi, 'lardons'],
  [/\bpave de saumon\b/gi, 'pavé de saumon'],
  [/\bpaves de saumon\b/gi, 'pavés de saumon'],
  [/\bfilet de cabillaud\b/gi, 'filet de cabillaud'],
  [/\bfilet de merlu\b/gi, 'filet de merlu'],
  [/\bfilet de saumon\b/gi, 'filet de saumon'],
  [/\bfilet de lieu\b/gi, 'filet de lieu'],
  [/\bfilet d['’]eglefin\b/gi, 'filet d\'églefin'],
  [/\bfilet de colin\b/gi, 'filet de colin'],
  [/\bfilet d['’]hareng\b/gi, 'filet de hareng'],
  [/\bmelange fruits de mer\b/gi, 'fruits de mer'],
  [/\blamelles? d['’]encornet\b/gi, 'encornet'],
  [/\bthon en boite\b/gi, 'thon'],
  [/\bharicot rouge en boite\b/gi, 'haricots rouges'],
  [/\bpois chiche en boite\b/gi, 'pois chiches'],
  [/\bpois chiche\b/gi, 'pois chiches'],
  [/\bharicot vert\b/gi, 'haricots verts'],
  [/\bharicot beurre\b/gi, 'haricots beurre'],
  [/\bharicot rouge\b/gi, 'haricots rouges'],
  [/\blentilles? corail\b/gi, 'lentilles corail'],
  [/\blentilles? verte(s)?\b/gi, 'lentilles vertes'],
  [/\bfeve(s)?\b/gi, 'fèves'],
  [/\bpetit pois( en boite)?\b/gi, 'petits pois'],
  [/\bcoeur d['’]artichaut(s)?\b/gi, 'cœurs d\'artichaut'],
  [/\bcoeurs d['’]artichaut\b/gi, 'cœurs d\'artichaut'],
  [/\bmais( en boite)?\b/gi, 'maïs'],
  [/\bbetterave cuite\b/gi, 'betterave'],
  [/\bbetterave cuite entiere\b/gi, 'betterave'],
  [/\bchou chinois\b/gi, 'chou chinois'],
  [/\bchou fleur\b/gi, 'chou-fleur'],
  [/\bchou romanesco\b/gi, 'chou romanesco'],
  [/\bcourgette ronde\b/gi, 'courgette ronde'],
  [/\bgrosse tomate\b/gi, 'grosses tomates'],
  [/\bmache\b/gi, 'mâche'],
  [/\bsucrine\b/gi, 'sucrines'],
  [/\bcebette\b/gi, 'cébettes'],
  [/\bradis rose\b/gi, 'radis rose'],
  [/\bdattes?\b/gi, 'dattes'],
  [/\bcacahouete(s)?\b/gi, 'cacahuètes'],
  [/\bpomelos\b/gi, 'pomelos'],
  [/\bmangue mure\b/gi, 'mangue'],
  [/\bgrenade\b/gi, 'grenade'],
  [/\bananas\b/gi, 'ananas'],
  [/\bfruit de la passion\b/gi, 'fruit de la passion'],
  [/\bmelange tofu\b/gi, 'tofu'],
  [/\btofu ferme\b/gi, 'tofu ferme'],
  [/\bcompote de pomme sans sucre\b/gi, 'compote de pomme'],
  [/\bnoix de coco rapee\b/gi, 'noix de coco râpée'],
  [/\blait de coco\b/gi, 'lait de coco'],
  [/\blait concentre\b/gi, 'lait concentré'],
  [/\blait de soja\b/gi, 'lait de soja'],
  [/\blait de soja ou amande\b/gi, 'lait végétal'],
  [/\bfromage frais\b/gi, 'fromage frais'],
  [/\bfromage blanc\b/gi, 'fromage blanc'],
  [/\bfromage a burger\b/gi, 'fromage'],
  [/\bphiladelphia\b/gi, 'philadelphia'],
  [/\bmozzarella rapee\b/gi, 'mozzarella'],
  [/\bmozzarella buffala\b/gi, 'mozzarella di buffala'],
  [/\bmozzarella bille\b/gi, 'billes de mozzarella'],
  [/\bemmental rape\b/gi, 'emmental râpé'],
  [/\bcheddar rapee?\b/gi, 'cheddar'],
  [/\bcheddar\b/gi, 'cheddar'],
  [/\bparmesan poudre\b/gi, 'parmesan'],
  [/\bcopeau parmesan\b/gi, 'copeaux de parmesan'],
  [/\bcopeau de parmesan\b/gi, 'copeaux de parmesan'],
  [/\bparmesan bloc\b/gi, 'parmesan'],
  [/\bfeta\b/gi, 'feta'],
  [/\bchevre buche\b/gi, 'chèvre frais'],
  [/\bboursin\b/gi, 'boursin'],
  [/\bricotta\b/gi, 'ricotta'],
  [/\bgorgonzola\b/gi, 'gorgonzola'],
  [/\bgouda\b/gi, 'gouda'],
  [/\bgrande tranche pain de mie\b/gi, 'pain de mie'],
  [/\bgrande tranche de pain de mie\b/gi, 'pain de mie'],
  [/\bpain de mie\b/gi, 'pain de mie'],
  [/\bpain bagel\b/gi, 'pain à bagel'],
  [/\bpain sans gluten\b/gi, 'pain sans gluten'],
  [/\bfeuille de brick\b/gi, 'feuilles de brick'],
  [/\bfeuille de wrap\b/gi, 'tortillas'],
  [/\bgalette de riz\b/gi, 'galettes de riz'],
  [/\btortillas de mais\b/gi, 'tortillas de maïs'],
  [/\bpinsa pate\b/gi, 'pâte à pinsa'],
  [/\briz a risotto\b/gi, 'riz à risotto'],
  [/\briz thai\b/gi, 'riz thaï'],
  [/\briz basmati\b/gi, 'riz basmati'],
  [/\briz complet\b/gi, 'riz complet'],
  [/\briz rond\b/gi, 'riz rond'],
  [/\briz\b/gi, 'riz'],
  [/\bnouilles? de riz\b/gi, 'nouilles de riz'],
  [/\bnouille aux oeufs\b/gi, 'nouilles aux œufs'],
  [/\bnouille chinoises\b/gi, 'nouilles chinoises'],
  [/\bnouilles? aux oeufs\b/gi, 'nouilles aux œufs'],
  [/\bvermicelle (de riz|chinois)\b/gi, 'vermicelles'],
  [/\btagliatelles? de konjac\b/gi, 'tagliatelles de konjac'],
  [/\bshirataki de konjac\b/gi, 'shirataki de konjac'],
  [/\bperles de konjac\b/gi, 'perles de konjac'],
  [/\bsarrasin( en grains)?\b/gi, 'sarrasin'],
  [/\bflocon(s)? d['’]avoine\b/gi, 'flocons d\'avoine'],
  [/\bsemoule a couscous( grain moyen)?\b/gi, 'semoule'],
  [/\bsemoule\b/gi, 'semoule'],
  [/\boeuf(s)?\b/gi, 'œufs'],
  [/\bechalote\b/gi, 'échalote'],
  [/\borange\b/gi, 'orange'],
  [/\bkiwi\b/gi, 'kiwi'],
  [/\bpomme verte\b/gi, 'pomme verte'],
  [/\bavocat\b/gi, 'avocat'],
  [/\bmelon\b/gi, 'melon'],
  [/\bbanane\b/gi, 'banane'],
  [/\bchocolat( noir)?\b/gi, 'chocolat'],
  [/\bpepites de chocolat\b/gi, 'pépites de chocolat'],
  [/\bpoudre d['’]amande\b/gi, 'poudre d\'amande'],
  // Typos source à corriger
  [/\bpoirvon\b/gi, 'poivron'],
  [/\bparpika\b/gi, 'paprika'],
  [/\bmozzarella rappee\b/gi, 'mozzarella'],
  [/\brappee\b/gi, 'râpée'],
  [/\bcheddar rappee?\b/gi, 'cheddar'],
  [/\bble pre cuit\b/gi, 'blé précuit'],
  [/\byaourt grecque\b/gi, 'yaourt grec'],
  [/\byaourt gre[cq]ue\b/gi, 'yaourt grec'],
  [/\byaourt greque\b/gi, 'yaourt grec'],
  [/\bcreme fraiche epaisse\b/gi, 'crème fraîche épaisse'],
  [/\bcrème fraîche epaisse\b/gi, 'crème fraîche épaisse'],
  [/\bgingenmbre\b/gi, 'gingembre'],
  [/\bcanelle\b/gi, 'cannelle'],
  [/\bchampignon de paris\b/gi, 'champignons de Paris'],
  [/\bchamps?ignon\b/gi, 'champignons'],
  [/\bcrevette decortiquees\b/gi, 'crevettes décortiquées'],
  [/\bcoeur d['’]artichaut\b/gi, 'cœurs d\'artichaut'],
]

function prettyIngredient(raw) {
  let s = raw.toLowerCase()
  for (const [re, rep] of ACCENTS) s = s.replace(re, rep)
  return s
}

function lower(s) {
  return s.toLowerCase()
    // mots à laisser en MAJ rien
    .replace(/\boeuf\b/g, 'œuf')
    .replace(/\boeufs\b/g, 'œufs')
}

// Choisit jusqu'à 3 ingrédients "nobles" (hors épices/herbes/condiments)
function pickKeyIngredients(ingredients, max = 3) {
  const seen = new Set()
  const out = []
  for (const raw of ingredients) {
    const label = ingredientLabel(raw).toUpperCase()
    if (NOISE_WORDS.has(label)) continue
    // Quelques sous-chaînes à exclure quand même
    if (/^MAÏ?ZENA$/.test(label)) continue
    if (/^FARINE/.test(label)) continue
    if (/^SAUCE\s/.test(label)) continue
    if (/^VINAIGRE/.test(label)) continue
    if (/^HUILE/.test(label)) continue
    if (/^SUCRE/.test(label)) continue
    if (/^EPICES/.test(label)) continue
    if (/^HERBES/.test(label)) continue
    if (label.length === 0) continue
    if (seen.has(label)) continue
    seen.add(label)
    out.push(label)
    if (out.length >= max) break
  }
  return out
}

function describeIngredient(label) {
  return prettyIngredient(label)
}

function joinFr(items) {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return items[0] + ' et ' + items[1]
  return items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1]
}

function generateDescription(name, ingredients, dishId) {
  // Override manuel d'abord
  if (dishId && MANUAL_DESCRIPTIONS[dishId]) return MANUAL_DESCRIPTIONS[dishId]

  const keyIngsRaw = pickKeyIngredients(ingredients || [], 3)
  const keyIngs = keyIngsRaw.map(describeIngredient)
  const lowerName = name.toLowerCase()

  // Détection du "type de plat"
  let prefix = ''
  if (/risotto/i.test(name)) prefix = 'Risotto crémeux'
  else if (/lasagne/i.test(name)) prefix = 'Lasagnes'
  else if (/^salade c[éeè]sar/i.test(name)) prefix = 'Salade César revisitée'
  else if (/^salade ni[çc]oise/i.test(name)) prefix = 'Salade niçoise traditionnelle'
  else if (/^salade tahitienne/i.test(name)) prefix = 'Salade tahitienne fraîche'
  else if (/^salade grecque/i.test(name)) prefix = 'Salade grecque'
  else if (/^salade /i.test(name)) prefix = 'Salade fraîche'
  else if (/^wok /i.test(name)) prefix = 'Wok sauté'
  else if (/^curry /i.test(name)) prefix = 'Curry'
  else if (/^chow mein/i.test(name)) prefix = 'Plat sauté chinois'
  else if (/^nasi goreng/i.test(name)) prefix = 'Riz frit indonésien'
  else if (/^pad tha[ïi]/i.test(name)) prefix = 'Pad thaï traditionnel'
  else if (/^maf[eé]/i.test(name)) prefix = 'Mafé mijoté'
  else if (/^dhal/i.test(name)) prefix = 'Dhal'
  else if (/^rougail/i.test(name)) prefix = 'Rougail réunionnais'
  else if (/^chili (sin|con)/i.test(name)) prefix = 'Chili mijoté'
  else if (/^chakchouka/i.test(name)) prefix = 'Chakchouka aux œufs'
  else if (/^moussaka/i.test(name)) prefix = 'Moussaka gratinée'
  else if (/^paella|^pa[eë]lla/i.test(name)) prefix = 'Paëlla'
  else if (/^fideu[aà]/i.test(name)) prefix = 'Fideuà espagnole'
  else if (/^mujadara/i.test(name)) prefix = 'Plat libanais de lentilles et riz'
  else if (/^poke bowls?/i.test(name)) prefix = 'Poke bowl frais'
  else if (/^bagel/i.test(name)) prefix = 'Bagel garni'
  else if (/^bruschetta/i.test(name)) prefix = 'Bruschetta'
  else if (/^pissaladi[èe]re/i.test(name)) prefix = 'Pissaladière niçoise'
  else if (/^tarte fine/i.test(name)) prefix = 'Tarte fine'
  else if (/^tarte smash/i.test(name)) prefix = 'Tarte de pommes de terre écrasées'
  else if (/^tarte/i.test(name)) prefix = 'Tarte'
  else if (/^quiche/i.test(name)) prefix = 'Quiche crémeuse'
  else if (/^tourte/i.test(name)) prefix = 'Tourte'
  else if (/^crumble/i.test(name)) prefix = 'Crumble'
  else if (/^galettes?/i.test(name)) prefix = 'Galettes'
  else if (/^boulettes?/i.test(name)) prefix = 'Boulettes'
  else if (/^kefta/i.test(name)) prefix = 'Boulettes orientales'
  else if (/^albondigas/i.test(name)) prefix = 'Boulettes espagnoles'
  else if (/^samossas?/i.test(name)) prefix = 'Samossas croustillants'
  else if (/^enchiladas?/i.test(name)) prefix = 'Enchiladas mexicaines'
  else if (/^chimichanga/i.test(name)) prefix = 'Chimichanga mexicaine'
  else if (/^frittata/i.test(name)) prefix = 'Frittata italienne'
  else if (/^tortilla/i.test(name)) prefix = 'Tortilla espagnole'
  else if (/^kuku/i.test(name)) prefix = 'Frittata persane'
  else if (/^sfougato/i.test(name)) prefix = 'Sfougato grec aux herbes'
  else if (/^gaspacho/i.test(name)) prefix = 'Soupe froide andalouse'
  else if (/^peperonata/i.test(name)) prefix = 'Peperonata italienne'
  else if (/^pav[éeèe] de/i.test(name)) prefix = name.match(/^pav[éeèe] de [^,]+/i)[0]
  else if (/^filet (de|mignon de)/i.test(name)) prefix = name.match(/^filet (?:de|mignon de) [^,&]+/i)[0]
  else if (/^cuisse de poulet|^haut de cuisse de poulet|^pilon/i.test(name)) prefix = name.match(/^[a-zà-ÿ' ]+poulet/i)[0]
  else if (/^cabillaud/i.test(name)) prefix = 'Cabillaud'
  else if (/^merlu/i.test(name)) prefix = 'Merlu'
  else if (/^saumon|^pav[éeèe] de saumon/i.test(name)) prefix = 'Saumon'
  else if (/^aubergines? farcies?/i.test(name)) prefix = 'Aubergines farcies'
  else if (/^poivrons? farci/i.test(name)) prefix = 'Poivrons farcis'
  else if (/^courgettes? rondes? farcies?/i.test(name)) prefix = 'Courgettes farcies'
  else if (/^tomates? farcies?/i.test(name)) prefix = 'Tomates farcies'
  else if (/^pomme de terre farcies?/i.test(name)) prefix = 'Pommes de terre farcies'
  else if (/^canelloni/i.test(name)) prefix = 'Cannellonis gratinés'
  else if (/^zoodles/i.test(name)) prefix = 'Spaghetti de courgettes'
  else if (/^tagliatelles?/i.test(name)) prefix = 'Tagliatelles'
  else if (/^haut de cuisse de poulet|^cuisse de poulet/i.test(name)) prefix = name.match(/^[a-zà-ÿ' ]+poulet/i)[0]
  else if (/^poulet/i.test(name)) prefix = 'Poulet'
  else if (/^porc /i.test(name)) prefix = 'Porc'
  else if (/^[éeèE]minc[éeè]/i.test(name)) prefix = name.match(/^[a-zà-ÿ' ]+/i)[0].trim()
  else if (/^croq mr/i.test(name)) prefix = 'Croque-monsieur revisité'
  else if (/^parmentier/i.test(name)) prefix = 'Parmentier'
  else if (/^flan coco/i.test(name)) prefix = 'Flan coco antillais'
  else if (/^g[âa]teau aux haricots/i.test(name)) return 'Gâteau fondant au chocolat à base de haricots rouges, sans gluten.'
  else if (/^aubergines? [àa] la parmigiana/i.test(name)) prefix = 'Aubergines gratinées à l\'italienne'
  else if (/^[œo]ufs? [àa] l['’]espagnole?/i.test(name)) prefix = 'Œufs durs sauce tomate à l\'espagnole'
  else if (/^poulet tikka/i.test(name)) prefix = 'Poulet tikka massala indien'
  else if (/^mijot[éeè] de/i.test(name)) prefix = 'Mijoté'
  else if (/^clafouti/i.test(name)) prefix = 'Clafoutis salé'
  else if (/^g[âa]teau de courgette/i.test(name)) prefix = 'Gâteau salé de courgettes'
  else prefix = 'Plat savoureux'

  // Évite la répétition : si le prefix contient déjà le 1er ingrédient, le supprimer
  const prefixWords = prefix.toLowerCase().split(/\s+/)
  const filteredIngs = keyIngs.filter(ing => {
    const ingWords = ing.split(/\s+/)
    return !ingWords.some(w => w.length > 4 && prefixWords.includes(w))
  })
  const finalIngs = filteredIngs.length >= 1 ? filteredIngs : keyIngs

  // Construction de la phrase — premier caractère en majuscule
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
  if (finalIngs.length >= 2) {
    return cap(prefix) + ' avec ' + joinFr(finalIngs.slice(0, 3)) + '.'
  }
  if (finalIngs.length === 1) {
    const article = /^[aeiouéàâêh]/i.test(finalIngs[0]) ? 'à l\'' : 'au '
    return cap(prefix) + ' ' + article + finalIngs[0] + '.'
  }
  // Pas d'ingrédient identifiable : utiliser le nom du plat (qui contient déjà tout)
  return cap(name) + ', recette ' + (prefix.toLowerCase() === 'plat savoureux' ? 'maison' : prefix.toLowerCase()) + '.'
}

async function main() {
  const filter = allSeasons
    ? sql`SELECT id, name, category, description, ingredients, seasons FROM dishes
          WHERE active = true AND (description IS NULL OR TRIM(description) = '')
          ORDER BY category, name`
    : sql`SELECT id, name, category, description, ingredients, seasons FROM dishes
          WHERE active = true
            AND (description IS NULL OR TRIM(description) = '')
            AND (seasons @> '"ete"'::jsonb OR seasons @> '"toutes"'::jsonb)
          ORDER BY category, name`

  const r = await filter
  console.log(`Plats sans description : ${r.rows.length}`)
  console.log(`Mode : ${isDryRun ? 'DRY-RUN' : 'CONFIRM (écriture)'}`)
  console.log()

  let updated = 0, failed = 0
  for (const d of r.rows) {
    try {
      const desc = generateDescription(d.name, d.ingredients || [], d.id)
      console.log(`  [${d.id}] ${d.name}`)
      console.log(`         → ${desc}`)
      if (!isDryRun) {
        await sql`UPDATE dishes SET description = ${desc}, updated_at = CURRENT_TIMESTAMP WHERE id = ${d.id}`
      }
      updated++
    } catch (e) {
      console.log(`  ❌ [${d.id}] ${d.name} — ${e.message}`)
      failed++
    }
  }

  console.log()
  console.log(`📊 ${updated} générées, ${failed} échecs`)
  if (isDryRun) console.log('\n💡 Pour appliquer : node scripts/generate-descriptions.js --confirm')
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })

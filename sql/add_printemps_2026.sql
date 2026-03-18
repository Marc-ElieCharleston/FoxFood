-- ============================================
-- MIGRATION: Printemps 2026
-- - Ajout catégorie 'desserts'
-- - Ajout colonne 'kids_food'
-- - Insertion des nouveaux plats printemps
-- - Tag 'printemps' sur les plats existants
-- ============================================

-- 1. Ajouter la catégorie 'desserts'
ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_category_check;
ALTER TABLE dishes ADD CONSTRAINT dishes_category_check
  CHECK (category IN ('viandes', 'poissons', 'vegetation', 'desserts'));

-- 2. Ajouter la colonne kids_food
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS kids_food BOOLEAN DEFAULT false;

-- 3. Ajouter la saison active dans les paramètres admin
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS active_season VARCHAR(20) DEFAULT 'printemps';

-- ============================================
-- 3. NOUVEAUX PLATS - VIANDES
-- ============================================

INSERT INTO dishes (name, category, description, ingredients, seasons, active, kids_food) VALUES
('Curry de courgette au chorizo & riz', 'viandes', 'Curry de courgettes au chorizo servi avec du riz', '["RIZ 100 GR", "COURGETTE 150 GR", "CHORIZO 35 GR", "LAIT DE COCO 100 ML", "AIL", "CURRY", "OIGNON"]', '["printemps"]', true, false),
('Rouleaux de printemps au poulet', 'viandes', 'Rouleaux de printemps frais garnis de poulet', '["GALETTE DE RIZ 1 PCE", "VERMICELLE DE RIZ 15 GR", "SAUCE SOJA 5 GR", "FEUILLE DE SALADE 2 PCE", "CREVETTE DECORTIQUEE 1 PCE", "FEUILLE DE MENTHE 2 PCE", "BLANC DE POULET EN TRANCHE 1 PCE", "HARICOT MUNGO 15 GR"]', '["printemps"]', true, false),
('Blanc de poulet rôti au fenouil et pois chiche', 'viandes', 'Blanc de poulet rôti accompagné de fenouil et pois chiches', '["BLANC DE POULET 100 GR", "PAPRIKA", "CURRY", "AIL", "PERSIL", "FENOUIL 50 GR", "POIS CHICHE 50 GR"]', '["printemps"]', true, false),
('Pâté de Pâques, mesclun & légumes croquants', 'viandes', 'Pâté en croûte de Pâques avec mesclun et crudités', '["PATE FEUILLETEE 1/2 PCE", "PORC HACHE 150 GR", "OEUF 1 PCE", "PERSIL", "LARDON 20 GR", "VIN BLANC CUISINE 5 CL", "LAIT 5 CL", "OIGNON", "CAROTTE 50 GR", "CONCOMBRE 1/4 PCE", "MESCLUN 50 GR", "RADIS ROSE 4 PCE"]', '["printemps"]', true, false),
('Pinsa Romana', 'viandes', 'Pizza romaine traditionnelle garnie de charcuterie et légumes', '["PINSA PATE 1 PCE", "SAUCE TOMATE PIZZA 90 GR", "MOZZARELLA RAPEE 50 GR", "MOZZARELLA BUFFALA 35 GR", "CHAMPIGNON DE PARIS 25 GR", "ORIGAN", "BASILIC FRAIS", "ROQUETTE 30 GR", "JAMBON CRU TRANCHE 1 PCE"]', '["printemps"]', true, true),
('Wrap épinards, feta & bacon', 'viandes', 'Wrap garni d''épinards, feta et bacon croustillant', '["FEUILLE DE WRAP 1 PCE", "PHILADELPHIA 40 GR", "POUSSE D''EPINARD 100 GR", "FETA 40 GR", "BACON 25 GR", "ORIGAN", "PAPRIKA", "CAROTTE 50 GR", "TOMATE SECHEE 40 GR"]', '["printemps"]', true, true),
('Curry de poulet, lait de coco, asperges & courgette', 'viandes', 'Curry de poulet crémeux au lait de coco avec asperges et courgettes', '["FILET DE POULET 1 PCE", "LAIT DE COCO 25 CL", "CURRY POUDRE", "CORIANDRE POUDRE", "COURGETTE 100 GR", "ASPERGE VERTE 100 GR", "AIL", "OIGNON"]', '["printemps"]', true, false),
('Courgette farcie façon pizza', 'viandes', 'Courgettes farcies à l''italienne façon pizza', '["COURGETTE 125 GR", "MOZZARELLA RAPEE 50 GR", "JAMBON BLANC TRANCHE 1 PCE", "CONCASSEE DE TOMATE 100 GR", "ORIGAN", "BASILIC", "AIL", "EPICES ITALIENNE"]', '["printemps"]', true, false),
('Filet de poulet grillé, tagliatelle de légumes & yaourt au tandoori', 'viandes', 'Poulet grillé tandoori avec tagliatelles de légumes', '["FILET DE POULET 1 PCE", "TANDOORI", "YAOURT 1 PCE", "CORIANDRE FRAICHE", "CAROTTE 150 GR", "COURGETTE 150 GR"]', '["printemps"]', true, false),
('Filet de poulet pané, purée de pomme de terre & sauce boursin', 'viandes', 'Poulet pané maison avec purée et sauce au boursin', '["FILET DE POULET 1 PCE", "CHAPELURE", "FARINE", "OEUF 1 PCE", "POMME DE TERRE 100 GR", "LAIT 10 CL", "BOURSIN 35 GR", "YAOURT 1 PCE"]', '["printemps"]', true, true),
('Lasagne de boeuf', 'viandes', 'Lasagnes traditionnelles à la bolognaise', '["BOEUF HACHE 100 GR", "PULPE DE TOMATE 125 GR", "LAIT 100 ML", "BEURRE 15 GR", "FARINE 15 GR", "MOZZARELLA RAPEE 25 GR", "CAROTTE 50 GR", "OIGNON", "CONCENTRE DE TOMATE 10 GR"]', '["printemps"]', true, true),
('Hachis parmentier', 'viandes', 'Hachis parmentier traditionnel au boeuf', '["BOEUF HACHE 125 GR", "CAROTTE 50 GR", "OIGNON", "FOND DE VEAU POUDRE 5 GR", "POMME DE TERRE PUREE 200 GR", "LAIT 10 CL", "BEURRE 5 GR", "CHAPELURE 10 GR"]', '["printemps"]', true, true),
('Mac & cheese crémeux au jambon', 'viandes', 'Macaroni au fromage crémeux avec jambon', '["COQUILLETTE 100 GR", "LAIT 250 ML", "CHEDDAR 50 GR", "JAMBON BLANC TRANCHE 2 PCE", "FARINE 15 GR", "BEURRE 15 GR"]', '["printemps"]', true, true),
('CroQ Mr façon Fox food', 'viandes', 'Croque-monsieur revisité façon Fox food', '["GRANDE TRANCHE DE PAIN DE MIE 2 PCE", "LAIT 100 ML", "BEURRE 15 GR", "FARINE 15 GR", "MOZZARELLA RAPEE 50 GR", "JAMBON BLANC TRANCHE 1,5 PCE", "FROMAGE A BURGER TRANCHE 2 PCE"]', '["printemps"]', true, true),
('Spaghetti bolognaise', 'viandes', 'Spaghetti sauce bolognaise classique', '["SPAGHETTI 100 GR", "BOEUF HACHE 100 GR", "CAROTTE 50 GR", "OIGNON", "CONCENTRE DE TOMATE 10 GR", "PULPE DE TOMATE 100 ML", "PARMESAN POUDRE 15 GR"]', '["printemps"]', true, true),
('Filet mignon de porc laqué, konjac aux légumes & huile de sésame', 'viandes', 'Filet mignon de porc laqué avec konjac et légumes sautés', '["FILET MIGNON PORC 100 GR", "KONJAC 100 GR", "COURGETTE 50 GR", "CAROTTE 50 GR", "CHAMPIGNON DE PARIS 25 GR", "AIL", "SAUCE SOJA 5 CL", "MIEL 5 GR", "HUILE DE SESAME 5 CL", "CORIANDRE FRAICHE 2 GR"]', '["printemps"]', true, false),
('Wok de poulet aux légumes printaniers', 'viandes', 'Wok de poulet sauté avec légumes de printemps', '["COURGETTE 50 GR", "POIVRON ROUGE 50 GR", "POUSSE DE SOJA 50 GR", "CAROTTE 50 GR", "CHAMPIGNON DE PARIS 50 GR", "SAUCE SOJA 5 CL", "MIEL 5 GR", "GINGEMBRE POUDRE", "AIL", "FILET DE POULET 1 PCE", "HUILE DE SESAME"]', '["printemps"]', true, false),
('Wok de boeuf aux légumes printaniers', 'viandes', 'Wok de boeuf sauté avec légumes de printemps', '["COURGETTE 50 GR", "POIVRON ROUGE 50 GR", "POUSSE DE SOJA 50 GR", "CAROTTE 50 GR", "CHAMPIGNON DE PARIS 50 GR", "SAUCE SOJA 5 CL", "MIEL 5 GR", "GINGEMBRE POUDRE", "AIL", "BAVETTE DE BOEUF 1 PCE", "HUILE DE SESAME"]', '["printemps"]', true, false),
('Tourte de boeuf façon empanadas', 'viandes', 'Tourte au boeuf épicée façon empanadas', '["PATE BRISEE 2 PCE", "BOEUF HACHE FRAIS 120 GR", "AIL", "PIMENT POUDRE", "PAPRIKA", "CONCASSEE DE TOMATE 50 GR", "EPICES MEXICAINES", "OEUF 1 PCE", "OIGNON", "CONCENTRE DE TOMATE 10 GR", "POIVRON 50 GR"]', '["printemps"]', true, false),
('Salade de riz thaï au poulet', 'viandes', 'Salade fraîche de riz thaï au poulet et crudités', '["RIZ 50 GR", "FILET DE POULET 50 GR", "CAROTTE 50 GR", "CACAHOUETES 5 GR", "SAUCE SOJA 10 CL", "MIEL", "GINGEMBRE", "CONCOMBRE 1/4 PCE", "CORIANDRE", "MENTHE", "HARICOT MUNGO 30 GR", "OEUF 1 PCE", "MOUTARDE"]', '["printemps"]', true, false),
('Boulettes de boeuf, tzatziki & taboulé de chou-fleur', 'viandes', 'Boulettes de boeuf avec tzatziki et taboulé de chou-fleur', '["BOEUF HACHE 100 GR", "CHOU FLEUR 1/4 PCE", "CONCOMBRE 1/2 PCE", "GRENADE 1/4 PCE", "MENTHE FRAICHE", "CAROTTE 50 GR", "OIGNON ROUGE 1/2 PCE", "YAOURT GRECQUE 1 PCE", "AIL", "CITRON JAUNE 1 PCE", "ANETH"]', '["printemps"]', true, false),
('Poke bowls au poulet & sauce tandoori', 'viandes', 'Poke bowl au poulet mariné tandoori', '["QUINOA 50 GR", "CONCOMBRE 1/4 PCE", "TOMATE CERISE 4 PCE", "FILET DE POULET 1/2 PCE", "BETTERAVE CUITE 50 GR", "CAROTTE 50 GR", "MAIS 30 GR", "YAOURT SOJA 1/2 PCE", "PERSIL", "SESAME GRAINES", "TANDOORI"]', '["printemps"]', true, false),
('Boeuf Lok Lak', 'viandes', 'Boeuf sauté cambodgien aux épices', '["BAVETTE DE BOEUF 100 GR", "SAUCE SOJA 5 CL", "SUCRE POUDRE", "AIL", "SESAME GRAINES", "SAUCE HUITRE 5 CL", "TOMATE 1 PCE", "CONCOMBRE 1/4 PCE", "TAGLIATELLE DE KONJAC 100 GR", "OIGNON ROUGE", "CORIANDRE", "PERSIL"]', '["printemps"]', true, false),
('Paëlla', 'viandes', 'Paëlla traditionnelle au poulet, fruits de mer et chorizo', '["RIZ ROND 100 GR", "POULET 100 GR", "CREVETTE 25 GR", "MOULES 4 PCE", "CHORIZO 25 GR", "POIVRONS 50 GR", "SAFRAN", "CURCUMA", "AIL", "CITRON JAUNE 1/2 PCE", "PETIT POIS 20 GR", "CONCASSEE DE TOMATE 25 CL", "PAPRIKA", "OIGNON"]', '["printemps"]', true, false),
('Fideuà', 'viandes', 'Fideuà espagnole au poulet et fruits de mer', '["PATE FIDEUA", "MELANGE FRUITS DE MER 50 GR", "POULET 100 GR", "POIVRON VERT 50 GR", "CONCASSEE DE TOMATE 25 CL", "PAPRIKA", "AIL", "OIGNON", "SAFRAN", "CURCUMA"]', '["printemps"]', true, false),
('Navarin d''agneau printanier', 'viandes', 'Navarin d''agneau aux légumes de printemps', '["SAUTE D''AGNEAU 100 GR", "NAVET 50 GR", "PETIT POIS 30 GR", "CAROTTE 50 GR", "OIGNON", "AIL", "CONCENTRE DE TOMATE 5 GR", "POMME DE TERRE GRENAILLES 60 GR", "THYM", "LAURIER"]', '["printemps"]', true, false),
('Courgette à la carbonara', 'viandes', 'Courgettes cuisinées façon carbonara aux lardons', '["COURGETTE 125 GR", "LARDON 25 GR", "OIGNON 10 GR", "VIN BLANC 5 CL", "PARMESAN POUDRE 20 GR", "CREME FRAICHE 20 CL"]', '["printemps"]', true, true),
('Salade de pâtes à l''italienne', 'viandes', 'Salade de pâtes fraîche à l''italienne', '["PATE FUSILLI 100 GR", "MOZZARELLA BILLE 37,5 GR", "TOMATE SECHE 20 GR", "OLIVE NOIR DENOYAUTE 25 GR", "POIVRON VERT 50 GR", "OIGNON ROUGE 1/4 PCE", "JAMBON CRU 1 TRANCHE", "BASILIC FRAIS", "PESTO 5 GR"]', '["printemps"]', true, true),
('Bruschetta au boeuf séché', 'viandes', 'Bruschetta aux légumes et viande des Grisons', '["PAIN SANS GLUTEN 1 TRANCHE", "FETA 50 GR", "MIEL", "ORIGAN", "YAOURT SOJA 20 GR", "RADIS ROSE 3 PCE", "CAROTTE 20 GR", "CONCOMBRE 30 GR", "BETTERAVE CUITE ENTIERE 25 GR", "VIANDE DES GRISONS 2,5 TRANCHES", "MACHE 30 GR"]', '["printemps"]', true, false)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. NOUVEAUX PLATS - POISSONS
-- ============================================

INSERT INTO dishes (name, category, description, ingredients, seasons, active, kids_food) VALUES
('Bagel saumon fumé & ricotta', 'poissons', 'Bagel garni de saumon fumé, ricotta et crudités', '["PAIN BAGEL 1 PCE", "SAUMON FUME TRANCHE 40 GR", "RICOTTA 40 GR", "CONCOMBRE 50 GR", "CAPRES 5 GR", "ANETH", "ROQUETTE 30 GR"]', '["printemps"]', true, false),
('Quiche au saumon fumé, boursin & asperge verte', 'poissons', 'Quiche crémeuse au saumon fumé et asperges', '["PATE BRISEE 1 PCE", "OEUFS 1,5 PCE", "CREME FRAICHE 15 CL", "SAUMON FUME 1 TRANCHE", "BOURSIN 35 GR", "ASPERGE VERTE 100 GR", "PARMESAN POUDRE 10 GR"]', '["printemps"]', true, true),
('Flan de carot''crabe', 'poissons', 'Flan de carottes au crabe', '["RILLETTE DE CRABE 35 GR", "CAROTTE 100 GR", "OEUF 1,5 PCE", "SEMI EPAIS SOJA 25 CL", "CIBOULETTE"]', '["printemps"]', true, true),
('Saumon en croûte de pistache, mousseline de chou-fleur & asperge verte', 'poissons', 'Pavé de saumon en croûte de pistache avec mousseline', '["PAVE DE SAUMON 1 PCE", "CHOU FLEUR 100 GR", "POMME DE TERRE 100 GR", "ASPERGE VERTE 100 GR", "PISTACHE 10 GR", "CHAPELURE 10 GR", "PARMESAN POUDRE 10 GR"]', '["printemps"]', true, false),
('Salade tahitienne au saumon & riz blanc', 'poissons', 'Salade tahitienne fraîche au saumon et lait de coco', '["LAIT DE COCO 25 CL", "CAROTTE 30 GR", "TOMATE 30 GR", "CITRON VERT 1 PCE", "SAUCE SOJA 5 CL", "CONCOMBRE 30 GR", "CORIANDRE FRAICHE", "RIZ THAI 50 GR", "PAVE DE SAUMON 1 PCE"]', '["printemps"]', true, false),
('Salade asiatique au hareng', 'poissons', 'Salade asiatique fraîche au hareng fumé', '["VERMICELLE CHINOIS 40 GR", "FILET DE HARENG 100 GR", "POMME VERTE 1/2 PCE", "CITRON VERT 1 PCE", "CEBETTE", "TANDOORI", "YAOURT 1 PCE", "SUCRE EN POUDRE"]', '["printemps"]', true, false),
('Filet de cabillaud rôti au pesto, quinoa aux tomates séchées, olive & courgettes', 'poissons', 'Cabillaud rôti au pesto avec quinoa méditerranéen', '["FILET DE CABILLAUD 100 GR", "PESTO 10 GR", "QUINOA 100 GR", "TOMATE SECHEE 40 GR", "OLIVE NOIR DENOYAUTE 25 GR", "COURGETTE 50 GR", "ORIGAN", "CITRON JAUNE 0,5 PCE"]', '["printemps"]', true, false),
('Filet de merlu en croûte de noix de coco, pousses soja & champignons au curry', 'poissons', 'Merlu en croûte de coco avec légumes au curry', '["FILET DE MERLU 100 GR", "NOIX DE COCO RAPEE 10 GR", "CHAPELURE 10 GR", "MIEL 5 GR", "POUSSE DE SOJA 90 GR", "CHAMPIGNON DE PARIS 50 GR", "CURRY POUDRE"]', '["printemps"]', true, false),
('Boulettes de saumon, sauce crémeuse à l''avocat, chou chinois & carottes', 'poissons', 'Boulettes de saumon avec sauce avocat et légumes', '["FILET DE SAUMON 100 GR", "OEUF 1 PCE", "CHAPELURE 10 GR", "AVOCAT 0,5 PCE", "FROMAGE BLANC 50 GR", "CIBOULETTE", "CHOU CHINOIS 100 GR", "CAROTTE 100 GR", "CITRON 0,5 PCE"]', '["printemps"]', true, false),
('Rougail d''encornets, tian de courgettes à la feta', 'poissons', 'Rougail d''encornets avec tian de courgettes', '["LAMELLES D''ENCORNET 100 GR", "AIL", "GINGEMBRE POUDRE", "CURCUMA POUDRE", "OIGNON", "PULPE DE TOMATE 75 GR", "CONCENTRE DE TOMATE 5 GR", "COURGETTE 150 GR", "FETA 50 GR", "ROMARIN"]', '["printemps"]', true, false),
('Filet de lieu, sauce vierge, houmous & poêlée de haricots verts aux carottes', 'poissons', 'Lieu sauce vierge avec houmous et légumes poêlés', '["FILET DE LIEU 100 GR", "POIS CHICHE EN BOITE 130 GR", "CUMIN", "HUILE DE SESAME 5 CL", "HARICOT VERT 100 GR", "CAROTTE 100 GR", "POIVRON ROUGE 50 GR", "CAPRES 5 GR", "CORNICHON 5 GR", "ECHALOTE 1 PCE", "CIBOULETTE", "PERSIL", "SAUCE SOJA 5 CL", "CITRON JAUNE 0,5 PCE"]', '["printemps"]', true, false),
('Filet de saumon poché au lait de coco & légumes printaniers', 'poissons', 'Saumon poché au lait de coco avec légumes de printemps', '["FILET DE SAUMON 100 GR", "LAIT DE COCO 50 ML", "VIN BLANC 5 CL", "ECHALOTE 1 PCE", "CURCUMA", "PETIT POIS 50 GR", "ASPERGE VERTE 100 GR", "CAROTTE 50 GR"]', '["printemps"]', true, false),
('Lasagne au saumon & courgette', 'poissons', 'Lasagnes crémeuses au saumon et courgettes', '["PATE A LASAGNE 62,5 GR", "FILET DE SAUMON 100 GR", "COURGETTE 100 GR", "LAIT 150 ML", "BEURRE 20 GR", "FARINE 20 GR", "MOZZARELLA RAPEE 50 GR", "ECHALOTE 1 PCE", "ANETH"]', '["printemps"]', true, false),
('Papitas, fromage blanc au cumin & peperonata', 'poissons', 'Boulettes de thon et quinoa avec peperonata', '["THON EN BOITE 50 GR", "QUINOA 100 GR", "AIL", "PERSIL", "OEUF 1 PCE", "CHAPELURE 50 GR", "FROMAGE BLANC 30 GR", "MIEL 10 GR", "CUMIN", "POIVRON JAUNE 50 GR", "POIVRON ROUGE 50 GR", "PULPE DE TOMATE 25 CL", "VINAIGRE DE VIN ROUGE 5 CL", "ECHALOTE 1 PCE"]', '["printemps"]', true, false),
('Bruschetta au saumon fumé', 'poissons', 'Bruschetta aux légumes et saumon fumé', '["PAIN SANS GLUTEN 1 TRANCHE", "FETA 50 GR", "MIEL", "ORIGAN", "YAOURT SOJA 20 GR", "RADIS ROSE 3 PCE", "CAROTTE 20 GR", "CONCOMBRE 30 GR", "BETTERAVE CUITE ENTIERE 25 GR", "SAUMON FUME TRANCHE 2 PCE", "MACHE 30 GR"]', '["printemps"]', true, false),
('Poke Bowls truite fumée', 'poissons', 'Poke bowl à la truite fumée et sauce concombre', '["QUINOA 50 GR", "CONCOMBRE 1/4 PCE", "TOMATE CERISE 4 PCE", "TRUITE FUME TRANCHE 1 PCE", "BETTERAVE CUITE 50 GR", "CAROTTE 50 GR", "MAIS 30 GR", "YAOURT SOJA 1/2 PCE", "PERSIL", "SESAME GRAINES"]', '["printemps"]', true, false),
('Amok (curry de poisson cambodgien)', 'poissons', 'Curry de cabillaud cambodgien au lait de coco', '["FILET DE CABILLAUD 100 GR", "LAIT DE COCO 25 CL", "CURRY", "CURCUMA", "PATE DE CREVETTE", "AIL", "GINGEMBRE", "CITRONELLE", "PAPRIKA", "SAUCE POISSON 5 CL", "OEUF 1 PCE", "RIZ THAI 100 GR"]', '["printemps"]', true, false),
('Crevettes crémeuses à la toscane, spaghetti quinoa tomate aux asperges vertes', 'poissons', 'Crevettes sauce toscane avec spaghetti et asperges', '["CREVETTES DECORTIQUEES 100 GR", "TOMATE SECHEE 20 GR", "AIL", "VIN BLANC CUISINE 5 CL", "PARMESAN POUDRE 10 GR", "CREME FRAICHE 10 CL", "POUSSE D''EPINARDS 50 GR", "SPAGHETTI QUINOA TOMATE 100 GR", "BASILIC", "ASPERGES VERTES 100 GR"]', '["printemps"]', true, false),
('Papillote d''églefin aux légumes printaniers', 'poissons', 'Églefin en papillote avec légumes de printemps', '["FILET D''EGLEFIN 100 GR", "CITRON JAUNE 0,5 PCE", "CAROTTE 60 GR", "COURGETTE 60 GR", "TOMATE CERISE 30 GR", "ASPERGES VERTES 100 GR", "PULPE DE TOMATE 30 GR", "PERSIL", "AIL", "PAPIER A PAPILLOTE"]', '["printemps"]', true, false),
('Terrine de poisson & crudités de saison', 'poissons', 'Terrine de colin aux crudités printanières', '["FILET DE COLIN 100 GR", "OEUFS 1 PCE", "FARINE 30 GR", "EMMENTAL RAPE 30 GR", "LEVURE CHIMIQUE", "CREME FRAICHE 12,5 CL", "MACHE 25 GR", "CAROTTE 50 GR", "RADIS ROSE 3 PCE", "CONCOMBRE 1/4 PCE"]', '["printemps"]', true, true),
('Tarte smash potatoes, saumon fumé & roquette', 'poissons', 'Tarte de pommes de terre écrasées au saumon fumé', '["POMME DE TERRE VAPEUR 100 GR", "SAUMON FUME 1 TRANCHE", "ROQUETTE 25 GR", "YAOURT GREC 1/2 PCE", "AIL", "JUS DE CITRON 5 CL", "CIBOULETTE", "PARMESAN POUDRE 15 GR", "THYM"]', '["printemps"]', true, true),
('Pavé de saumon grillé, sauce betterave, tagliatelles de konjac aux petits pois & fèves', 'poissons', 'Saumon grillé sauce betterave avec konjac et légumineuses', '["PAVE DE SAUMON 1 PCE", "BETTERAVE CUITE 50 GR", "SEMI EPAIS SOJA 7 CL", "TAGLIATELLE DE KONJAC 100 GR", "PETIT POIS 35 GR", "FEVES 35 GR", "ECHALOTE 1/2 PCE", "BASILIC"]', '["printemps"]', true, false),
('Cabillaud rôti miso, pak choï & boulgour au curcuma', 'poissons', 'Cabillaud glacé au miso avec pak choï et boulgour', '["FILET DE CABILLAUD 100 GR", "MISO", "PAK CHOI 1/2 PCE", "CITRON JAUNE 1/2 PCE", "SAUCE SOJA 5 CL", "MIEL", "BOULGOUR 100 GR", "CURCUMA"]', '["printemps"]', true, false),
('Rouleaux de printemps aux crevettes', 'poissons', 'Rouleaux de printemps frais garnis de crevettes', '["GALETTE DE RIZ 1 PCE", "VERMICELLE DE RIZ 15 GR", "SAUCE SOJA 5 GR", "FEUILLE DE SALADE 2 PCE", "CREVETTE DECORTIQUEE 1 PCE", "FEUILLE DE MENTHE 2 PCE", "HARICOT MUNGO 15 GR", "CREVETTES DECORTIQUEES 25 GR"]', '["printemps"]', true, false),
('Wok de crevettes aux légumes printaniers', 'poissons', 'Wok de crevettes sautées avec légumes de printemps', '["COURGETTE 50 GR", "POIVRON ROUGE 50 GR", "POUSSE DE SOJA 50 GR", "CAROTTE 50 GR", "CHAMPIGNON DE PARIS 50 GR", "SAUCE SOJA 5 CL", "MIEL 5 GR", "GINGEMBRE POUDRE", "AIL", "CREVETTES DECORTIQUEES 35 GR", "HUILE DE SESAME"]', '["printemps"]', true, false),
('Courgette farcie au thon', 'poissons', 'Courgettes farcies au thon et tomate', '["COURGETTE 125 GR", "CONCASSEE DE TOMATE 50 GR", "THON EN BOITE 25 GR", "EMMENTAL RAPE 10 GR", "HERBES DE PROVENCE", "OIGNON", "PAPRIKA"]', '["printemps"]', true, false)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. NOUVEAUX PLATS - VEGETATION
-- ============================================

INSERT INTO dishes (name, category, description, ingredients, seasons, active, kids_food) VALUES
('Mujadara', 'vegetation', 'Plat libanais de lentilles et riz aux oignons caramélisés', '["LENTILLES VERTES 75 GR", "RIZ COMPLET 45 GR", "CUMIN", "CORIANDRE", "YAOURT 1 PCE", "OIGNON"]', '["printemps"]', true, false),
('Tarte courgette/feta', 'vegetation', 'Tarte brisée aux courgettes et feta', '["PATE BRISE", "OEUF 1 PCE", "CREME FRAICHE 10 CL", "COURGETTE 50 GR", "FETA 35 GR"]', '["printemps"]', true, true),
('Salade de boulgour, petit pois, pois gourmand, oeuf & pesto', 'vegetation', 'Salade printanière de boulgour aux petits pois et pesto', '["BOULGOUR 60 GR", "PETIT POIS 50 GR", "POIS GOURMAND 50 GR", "OEUF 1 PCE", "PESTO 5 GR"]', '["printemps"]', true, false),
('Falafel, haricots verts, écrasée de patate douce et yaourt à la ciboulette', 'vegetation', 'Falafels maison avec patate douce et haricots verts', '["POIS CHICHE EN BOITE 100 GR", "AIL", "PERSIL", "CUMIN", "OEUF 1 PCE", "FARINE 35 GR", "OIGNON", "PATATE DOUCE 200 GR", "HARICOT VERT 100 GR", "YAOURT 1 PCE", "CIBOULETTE"]', '["printemps"]', true, false),
('Feuilleté chèvre/miel & salade de quinoa, tomate séchée et olive', 'vegetation', 'Feuilleté au chèvre et miel avec salade de quinoa', '["PATE FEUILLETE", "CHEVRE BUCHE 50 GR", "MIEL", "QUINOA 100 GR", "TOMATE SECHEE 10 GR", "ORIGAN", "OLIVE DENOYAUTE 10 GR"]', '["printemps"]', true, false),
('Kuku aux courgettes & salade de carottes au tofu', 'vegetation', 'Frittata persane aux courgettes avec salade de carottes', '["COURGETTE 125 GR", "AIL", "PIGNON PIN", "LEVURE CHIMIQUE", "OEUF 1,5 PCE", "PERSIL", "MENTHE", "CORIANDRE", "FARINE 30 GR"]', '["printemps"]', true, false),
('Pad thaï au tofu', 'vegetation', 'Pad thaï végétarien au tofu ferme', '["TOFU FERME 110 GR", "SAUCE SRIRACHA 2,5 ML", "NOUILLES DE RIZ 50 GR", "CORIANDRE FRAICHE 5 GR", "AIL", "GINGEMBRE POUDRE", "CACAHOUETES 5 GR", "POUSSE DE SOJA 25 GR", "CAROTTE 50 GR", "OIGNON VERT 5 GR", "VINAIGRE DE RIZ 5 ML", "SAUCE SOJA 5 ML", "SUCRE POUDRE", "PATE DE TAMARIN 5 GR", "OEUF 1 PCE"]', '["printemps"]', true, false),
('Mafé aux haricots rouges & riz', 'vegetation', 'Mafé végétarien aux haricots rouges et cacahuètes', '["HARICOT ROUGE EN BOITE 120 GR", "CONCASSEE DE TOMATE 100 GR", "CAROTTE 100 GR", "BEURRE DE CACAHOUETES 20 GR", "AIL", "OIGNON", "RIZ BASMATI 100 GR", "CORIANDRE FRAICHE 5 GR", "CACAHOUETES 5 GR"]', '["printemps"]', true, false),
('Crumble de courgette au chèvre', 'vegetation', 'Crumble salé de courgettes au chèvre et parmesan', '["COURGETTE 125 GR", "PARMESAN 10 GR", "FARINE 15 GR", "HUILE OLIVE 10 GR", "CHEVRE BUCHE 45 GR", "AIL"]', '["printemps"]', true, false),
('Galette de carottes aux flocons d''avoine, ktipiti & quinoa aux poivrons', 'vegetation', 'Galettes de carottes avec ktipiti et quinoa aux poivrons', '["CAROTTE 100 GR", "FLOCON D''AVOINE 35 GR", "OEUF 1 PCE", "LAIT DE SOJA 25 GR", "FETA 50 GR", "ORIGAN", "POIVRON ROUGE 50 GR", "YAOURT SOJA 20 GR", "PAPRIKA", "PERSIL", "QUINOA 100 GR", "POIVRON VERT 75 GR"]', '["printemps"]', true, false),
('Clafoutis de carottes, curry et chèvre', 'vegetation', 'Clafoutis salé aux carottes, curry et chèvre', '["CAROTTE 100 GR", "SEMI EPAIS DE SOJA 25 CL", "OEUF 1,5 PCE", "CHEVRE BUCHE 45 GR", "CURRY POUDRE", "AIL", "PERSIL"]', '["printemps"]', true, false),
('Risotto aux asperges', 'vegetation', 'Risotto crémeux aux asperges vertes et parmesan', '["RIZ A RISOTTO 80 GR", "PARMESAN POUDRE 20 GR", "VIN BLANC 5 CL", "OIGNON", "CREME FRAICHE 10 CL", "ASPERGE VERTE 100 GR"]', '["printemps"]', true, false),
('Tortilla aux asperges vertes', 'vegetation', 'Tortilla espagnole aux asperges vertes', '["OEUFS 2 PCE", "POMME DE TERRE 100 GR", "ASPERGE VERTE 100 GR", "PERSIL", "AIL", "OIGNON", "SEMI EPAIS SOJA 10 CL"]', '["printemps"]', true, false),
('Tortilla aux épinards', 'vegetation', 'Tortilla espagnole aux épinards', '["OEUFS 2 PCE", "POMME DE TERRE 100 GR", "PERSIL", "AIL", "OIGNON", "SEMI EPAIS SOJA 10 CL", "POUSSE D''EPINARD 100 GR"]', '["printemps"]', true, false),
('Paella végétarienne au tofu', 'vegetation', 'Paella végétarienne au tofu et légumes', '["RIZ 100 GR", "POIVRON ROUGE 50 GR", "PETIT POIS 40 GR", "OIGNON", "AIL", "PAPRIKA", "CURCUMA", "TOFU FERME 50 GR", "OLIVE DENOYAUTE 30 GR", "CONCASSEE DE TOMATE 50 GR", "PERSIL"]', '["printemps"]', true, false),
('Risotto à la milanaise', 'vegetation', 'Risotto au safran à la milanaise', '["RIZ A RISOTTO 100 GR", "POUDRE A SAFRAN 1 DOSE", "OIGNON", "VIN BLANC 5 CL", "PARMESAN POUDRE 15 GR", "COPEAU PARMESAN 10 GR"]', '["printemps"]', true, false),
('Nasi Goreng', 'vegetation', 'Riz frit indonésien au tofu et légumes', '["RIZ THAI 100 GR", "CONCOMBRE 100 GR", "CAROTTE 100 GR", "CEBETTE", "AIL", "OEUF 1 PCE", "SAUCE SOJA SUCRE 5 CL", "TOFU FERME 50 GR", "HARICOT VERT 25 GR", "CORIANDRE FRAICHE", "ECHALOTE 1 PCE", "POIVRON ROUGE 20 GR", "GINGEMBRE"]', '["printemps"]', true, false),
('Wok de légumes printaniers', 'vegetation', 'Wok de légumes frais de printemps aux pois chiches', '["COURGETTE 50 GR", "POIVRON ROUGE 50 GR", "POUSSE DE SOJA 50 GR", "CAROTTE 50 GR", "CHAMPIGNON DE PARIS 50 GR", "SAUCE SOJA 5 CL", "MIEL 5 GR", "GINGEMBRE POUDRE", "AIL", "POIS CHICHE 35 GR"]', '["printemps"]', true, false),
('Galettes de lentilles corail, carottes & compotée de courgettes aux poivrons', 'vegetation', 'Galettes de lentilles corail avec compotée de légumes', '["LENTILLES CORAIL 100 GR", "CAROTTE 100 GR", "FLOCONS D''AVOINE 50 GR", "MAIZENA", "AIL", "CUMIN", "PAPRIKA", "YAOURT SOJA 1 PCE", "MENTHE", "POIVRON ROUGE 100 GR", "PULPE DE TOMATE 50 GR", "COURGETTE 100 GR"]', '["printemps"]', true, true),
('Boulettes de lentilles, patates douces & curry de carottes aux épinards', 'vegetation', 'Boulettes de lentilles avec curry de carottes et épinards', '["LENTILLES CORAIL 100 GR", "CUMIN", "AIL", "PATATE DOUCE 100 GR", "FARINE", "OEUF 1 PCE", "CHAPELURE 10 GR", "CAROTTE 150 GR", "CURRY", "CORIANDRE", "LAIT DE COCO 25 CL", "POUSSE D''EPINARD 100 GR"]', '["printemps"]', true, true),
('Bruschetta aux légumes', 'vegetation', 'Bruschetta aux légumes frais et feta', '["PAIN SANS GLUTEN 1 TRANCHE", "FETA 50 GR", "MIEL", "ORIGAN", "YAOURT SOJA 20 GR", "RADIS ROSE 3 PCE", "CAROTTE 20 GR", "CONCOMBRE 30 GR", "BETTERAVE CUITE ENTIERE 25 GR", "OEUF 1 PCE", "MACHE 30 GR"]', '["printemps"]', true, false),
('Poke Bowls végétarien', 'vegetation', 'Poke bowl végétarien aux pois chiches et légumes', '["QUINOA 50 GR", "CONCOMBRE 1/4 PCE", "TOMATE CERISE 4 PCE", "POIS CHICHE 65 GR", "BETTERAVE CUITE 50 GR", "CAROTTE 50 GR", "MAIS 30 GR", "YAOURT SOJA 1/2 PCE", "PERSIL", "SESAME GRAINES"]', '["printemps"]', true, false)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. NOUVEAUX PLATS - DESSERTS
-- ============================================

INSERT INTO dishes (name, category, description, ingredients, seasons, active, kids_food) VALUES
('Gâteau au yaourt light', 'desserts', 'Gâteau au yaourt allégé', '["SUCRE POUDRE 62,5 GR", "FARINE 95 GR", "OEUFS 1 PCE", "BEURRE 12,5 GR", "LEVURE CHIMIQUE 1/4 SACHET", "YAOURT SKYR 0,5 PCE"]', '["printemps"]', true, false),
('Salade de fruits à la vanille', 'desserts', 'Salade de fruits exotiques parfumée à la vanille', '["KIWI 1 PCE", "ORANGE 1 PCE", "ANANAS 1/4 PCE", "POMELOS 1/4 PCE", "FRUIT DE LA PASSION 1 PCE", "VANILLE POUDRE"]', '["printemps"]', true, false),
('Brioche minute healthy', 'desserts', 'Brioche rapide et légère à la compote', '["FARINE 75 GR", "LEVURE CHIMIQUE 1/4 SACHET", "COMPOTE DE POMME SANS SUCRE 50 GR", "LAIT DE SOJA OU AMANDE 25 CL", "PEPITES DE CHOCOLAT 5 GR"]', '["printemps"]', true, false),
('Energy balls', 'desserts', 'Boules d''énergie aux dattes et cacao', '["DATTES 50 GR", "FLOCONS D''AVOINE 15 GR", "POUDRE D''AMANDE 15 GR", "BEURRE DE CACAHOUETES", "CACAO POUDRE"]', '["printemps"]', true, false),
('Gâteau moelleux au citron IG bas', 'desserts', 'Gâteau moelleux au citron à indice glycémique bas', '["POUDRE D''AMANDE 45 GR", "OEUFS 1 PCE", "SUCRE DE CANNE POUDRE 7,5 GR", "HUILE OLIVE BIO 12,5 GR", "CREME DE COCO 20 GR", "CITRON JAUNE 1/4 PCE", "LEVURE CHIMIQUE 1/4 SACHET", "GRAINES DE PAVOT"]', '["printemps"]', true, false),
('Flan pâtissier', 'desserts', 'Flan pâtissier traditionnel à la vanille', '["PATE BRISEE", "LAIT 25 CL", "OEUFS 3 PCE", "MAIZENA 30 GR", "VANILLE POUDRE", "SUCRE POUDRE 37,5 GR"]', '["printemps"]', true, false),
('Crumble aux bananes & chocolat', 'desserts', 'Crumble gourmand banane et pépites de chocolat', '["FARINE 12,5 GR", "SUCRE POUDRE 12,5 GR", "NOIX DE COCO RAPEE 12,5 GR", "PEPITES DE CHOCOLAT 25 GR", "BANANE 1 PCE", "BEURRE 6,25 GR"]', '["printemps"]', true, false),
('Gâteau fondant au chocolat', 'desserts', 'Gâteau fondant au chocolat noir', '["CHOCOLAT 42 GR", "BEURRE 25 GR", "FARINE 10 GR", "SUCRE POUDRE 25 GR", "OEUFS 0,5 PCE"]', '["printemps"]', true, false)
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. TAGGER LES PLATS EXISTANTS AVEC 'printemps'
-- Ajoute 'printemps' aux saisons sans supprimer les existantes
-- ============================================

-- Plats déjà existants qui doivent aussi être disponibles au printemps
UPDATE dishes
SET seasons = (
  CASE
    WHEN seasons @> '"printemps"'::jsonb THEN seasons
    ELSE (seasons - 'toutes') || '["printemps"]'::jsonb
  END
),
updated_at = CURRENT_TIMESTAMP
WHERE name IN (
  'Poulet tikka masala',
  'Parmentier végan',
  'Brandade de colin',
  'Brandade de sardines',
  'Dhal de lentilles aux patates douces',
  'Chow mein aux crevettes',
  'Chow mein au boeuf',
  'Chow mein au porc',
  'Chow mein au poulet',
  'Curry de crevettes au lait de coco & riz blanc',
  'Curry de crevettes, patate douce & lait de coco',
  'Chow mein aux légumes',
  'Chow mein aux legumes',
  'Curry de légumes',
  'Curry de legumes',
  'Couscous'
)
AND NOT seasons @> '"printemps"'::jsonb;

-- Note: Noms dupliqués avec/sans accents pour couvrir les variantes possibles en base

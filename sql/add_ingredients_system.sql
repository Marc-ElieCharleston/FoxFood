-- Migration: Système complet d'ingrédients avec tags alimentaires
-- Les ingrédients ont des tags (porc, produit_laitier, etc.)
-- Les variantes héritent automatiquement des tags de leurs ingrédients

-- 1. Table des ingrédients
CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  default_unit VARCHAR(20) DEFAULT 'g', -- g, kg, ml, L, pièce, c.à.s, c.à.c, etc.
  dietary_tags JSONB DEFAULT '[]', -- ['porc', 'produit_laitier', 'gluten', etc.]
  category VARCHAR(50), -- viande, légume, épice, produit_laitier, etc.
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table de liaison variantes <-> ingrédients avec quantités
CREATE TABLE IF NOT EXISTS variant_ingredients (
  id SERIAL PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES dish_variants(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit VARCHAR(20), -- Peut être différent de l'unité par défaut
  notes VARCHAR(255), -- "émincé", "haché", etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(variant_id, ingredient_id)
);

-- 3. Ajouter les préférences alimentaires aux utilisateurs
ALTER TABLE users
ADD COLUMN IF NOT EXISTS dietary_preferences JSONB DEFAULT '[]';

-- 4. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
CREATE INDEX IF NOT EXISTS idx_ingredients_tags ON ingredients USING GIN (dietary_tags);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
CREATE INDEX IF NOT EXISTS idx_variant_ingredients_variant ON variant_ingredients(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_ingredients_ingredient ON variant_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_users_dietary_preferences ON users USING GIN (dietary_preferences);

-- 5. Insérer quelques ingrédients de base avec leurs tags
INSERT INTO ingredients (name, default_unit, dietary_tags, category) VALUES
  -- Viandes
  ('Poulet', 'g', '[]', 'viande'),
  ('Boeuf', 'g', '[]', 'viande'),
  ('Porc', 'g', '["porc"]', 'viande'),
  ('Lardons', 'g', '["porc"]', 'viande'),
  ('Jambon', 'g', '["porc"]', 'viande'),
  ('Saucisse', 'g', '["porc"]', 'viande'),
  ('Agneau', 'g', '[]', 'viande'),
  ('Veau', 'g', '[]', 'viande'),
  ('Canard', 'g', '[]', 'viande'),
  ('Dinde', 'g', '[]', 'viande'),

  -- Poissons et fruits de mer
  ('Saumon', 'g', '["poisson"]', 'poisson'),
  ('Cabillaud', 'g', '["poisson"]', 'poisson'),
  ('Thon', 'g', '["poisson"]', 'poisson'),
  ('Crevettes', 'g', '["fruits_de_mer"]', 'poisson'),
  ('Moules', 'g', '["fruits_de_mer"]', 'poisson'),

  -- Produits laitiers
  ('Lait', 'ml', '["produit_laitier"]', 'produit_laitier'),
  ('Crème fraîche', 'ml', '["produit_laitier"]', 'produit_laitier'),
  ('Beurre', 'g', '["produit_laitier"]', 'produit_laitier'),
  ('Fromage râpé', 'g', '["produit_laitier"]', 'produit_laitier'),
  ('Parmesan', 'g', '["produit_laitier"]', 'produit_laitier'),
  ('Mozzarella', 'g', '["produit_laitier"]', 'produit_laitier'),
  ('Yaourt', 'g', '["produit_laitier"]', 'produit_laitier'),

  -- Féculents
  ('Pâtes', 'g', '["gluten"]', 'féculent'),
  ('Riz', 'g', '[]', 'féculent'),
  ('Pommes de terre', 'g', '[]', 'féculent'),
  ('Pain', 'g', '["gluten"]', 'féculent'),
  ('Farine', 'g', '["gluten"]', 'féculent'),
  ('Semoule', 'g', '["gluten"]', 'féculent'),

  -- Légumes
  ('Tomates', 'g', '[]', 'légume'),
  ('Oignons', 'g', '[]', 'légume'),
  ('Ail', 'gousse', '[]', 'légume'),
  ('Carottes', 'g', '[]', 'légume'),
  ('Courgettes', 'g', '[]', 'légume'),
  ('Poivrons', 'g', '[]', 'légume'),
  ('Champignons', 'g', '[]', 'légume'),
  ('Épinards', 'g', '[]', 'légume'),
  ('Haricots verts', 'g', '[]', 'légume'),
  ('Brocoli', 'g', '[]', 'légume'),
  ('Aubergines', 'g', '[]', 'légume'),
  ('Salade', 'g', '[]', 'légume'),

  -- Fruits à coque
  ('Amandes', 'g', '["fruits_a_coque"]', 'fruits_a_coque'),
  ('Noix', 'g', '["fruits_a_coque"]', 'fruits_a_coque'),
  ('Noisettes', 'g', '["fruits_a_coque"]', 'fruits_a_coque'),
  ('Cacahuètes', 'g', '["fruits_a_coque", "arachide"]', 'fruits_a_coque'),

  -- Oeufs
  ('Oeufs', 'pièce', '["oeuf"]', 'oeuf'),

  -- Épices et condiments
  ('Sel', 'g', '[]', 'épice'),
  ('Poivre', 'g', '[]', 'épice'),
  ('Huile d''olive', 'ml', '[]', 'condiment'),
  ('Vinaigre', 'ml', '[]', 'condiment'),
  ('Sauce soja', 'ml', '["soja", "gluten"]', 'condiment'),
  ('Moutarde', 'g', '[]', 'condiment'),
  ('Herbes de Provence', 'g', '[]', 'épice'),
  ('Curry', 'g', '[]', 'épice'),
  ('Paprika', 'g', '[]', 'épice'),
  ('Cumin', 'g', '[]', 'épice')
ON CONFLICT (name) DO NOTHING;

-- 6. Mettre à jour la table dietary_tags pour ajouter les tags d'ingrédients
INSERT INTO dietary_tags (name, emoji, description) VALUES
  ('porc', '🐷', 'Contient du porc'),
  ('produit_laitier', '🥛', 'Contient des produits laitiers'),
  ('gluten', '🌾', 'Contient du gluten'),
  ('poisson', '🐟', 'Contient du poisson'),
  ('fruits_de_mer', '🦐', 'Contient des fruits de mer'),
  ('fruits_a_coque', '🥜', 'Contient des fruits à coque'),
  ('oeuf', '🥚', 'Contient des oeufs'),
  ('soja', '🫘', 'Contient du soja'),
  ('arachide', '🥜', 'Contient des arachides')
ON CONFLICT (name) DO NOTHING;

-- 7. Ajouter la colonne selected_variants si elle n'existe pas
ALTER TABLE weekly_selections
ADD COLUMN IF NOT EXISTS selected_variants JSONB DEFAULT '{}';

-- 8. Commentaires pour documentation
COMMENT ON TABLE ingredients IS 'Ingrédients disponibles avec leurs tags alimentaires';
COMMENT ON TABLE variant_ingredients IS 'Liaison entre variantes de plats et ingrédients avec quantités';
COMMENT ON COLUMN users.dietary_preferences IS 'Préférences alimentaires du client (tags à exclure): ["sans_porc", "sans_lactose", etc.]';

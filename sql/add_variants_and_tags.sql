-- Migration: Ajouter les variantes de plats et les tags alimentaires
-- Permet d'avoir plusieurs déclinaisons d'un même plat (ex: Lasagnes classique, halal, végétarien)
-- Chaque variante peut avoir ses propres tags et ingrédients

-- 1. Créer la table des tags alimentaires disponibles
CREATE TABLE IF NOT EXISTS dietary_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  emoji VARCHAR(10),
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insérer les tags de base
INSERT INTO dietary_tags (name, emoji, description) VALUES
  ('halal', '🟢', 'Viande halal certifiée'),
  ('sans_porc', '🚫🐷', 'Ne contient pas de porc'),
  ('sans_lactose', '🥛❌', 'Sans produits laitiers'),
  ('sans_gluten', '🌾❌', 'Sans gluten'),
  ('sans_fruits_coque', '🥜❌', 'Sans fruits à coque'),
  ('vegan', '🌱', 'Sans produits d''origine animale'),
  ('vegetarien', '🥬', 'Sans viande ni poisson'),
  ('epice', '🌶️', 'Plat épicé'),
  ('enfant', '👶', 'Adapté aux enfants')
ON CONFLICT (name) DO NOTHING;

-- 3. Créer la table des variantes de plats
CREATE TABLE IF NOT EXISTS dish_variants (
  id SERIAL PRIMARY KEY,
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,  -- Ex: "Classique", "Halal", "Végétarien"
  ingredients JSONB DEFAULT '[]',  -- Ingrédients spécifiques à cette variante
  tags JSONB DEFAULT '[]',  -- Tags alimentaires (références aux noms des tags)
  is_default BOOLEAN DEFAULT false,  -- Variante par défaut
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_dish_variants_dish_id ON dish_variants(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_variants_tags ON dish_variants USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_dish_variants_active ON dish_variants(active);

-- 5. Migrer les ingrédients existants vers une variante "Classique" par défaut
-- Pour chaque plat qui a des ingrédients, créer une variante par défaut
INSERT INTO dish_variants (dish_id, name, ingredients, is_default, active)
SELECT
  id as dish_id,
  'Classique' as name,
  COALESCE(ingredients, '[]'::jsonb) as ingredients,
  true as is_default,
  true as active
FROM dishes
WHERE NOT EXISTS (
  SELECT 1 FROM dish_variants dv WHERE dv.dish_id = dishes.id
);

-- 6. Pour les plats sans variantes, créer une variante par défaut vide
INSERT INTO dish_variants (dish_id, name, ingredients, is_default, active)
SELECT
  id as dish_id,
  'Classique' as name,
  '[]'::jsonb as ingredients,
  true as is_default,
  true as active
FROM dishes
WHERE NOT EXISTS (
  SELECT 1 FROM dish_variants dv WHERE dv.dish_id = dishes.id
);

-- Note: On garde la colonne ingredients dans dishes pour la rétrocompatibilité
-- mais les nouvelles données seront dans dish_variants

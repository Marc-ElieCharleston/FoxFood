-- Table pour les surcharges personnalisées de plats par utilisateur
-- Permet de masquer des plats, renommer, supprimer ou substituer des ingrédients par plat
CREATE TABLE IF NOT EXISTS user_dish_overrides (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  action VARCHAR(10) NOT NULL DEFAULT 'modify' CHECK (action IN ('modify', 'hide')),
  custom_name VARCHAR(255),
  remove_ingredients JSONB DEFAULT '[]',       -- [{ingredient_id: 5}]
  substitute_ingredients JSONB DEFAULT '[]',   -- [{from_ingredient_id: 1, to_ingredient_id: 2}]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, dish_id)
);

CREATE INDEX idx_user_dish_overrides_user ON user_dish_overrides(user_id);

COMMENT ON TABLE user_dish_overrides IS 'Surcharges personnalisées de plats par utilisateur (renommage, masquage, substitutions par plat)';
COMMENT ON COLUMN user_dish_overrides.action IS 'modify = modifier le plat, hide = masquer complètement';
COMMENT ON COLUMN user_dish_overrides.custom_name IS 'Nom personnalisé du plat (null = garder le nom original)';
COMMENT ON COLUMN user_dish_overrides.remove_ingredients IS 'Liste des ingrédients à retirer [{ingredient_id: N}]';
COMMENT ON COLUMN user_dish_overrides.substitute_ingredients IS 'Substitutions [{from_ingredient_id: N, to_ingredient_id: M}]';

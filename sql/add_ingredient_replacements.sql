-- Table pour stocker les remplacements d'ingrédients par utilisateur
CREATE TABLE IF NOT EXISTS user_ingredient_replacements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  replacement_ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, original_ingredient_id)
);

-- Index pour performance
CREATE INDEX idx_user_ingredient_replacements_user ON user_ingredient_replacements(user_id);

-- Commentaires
COMMENT ON TABLE user_ingredient_replacements IS 'Remplacements d''ingrédients personnalisés par utilisateur (ex: lait -> soja)';
COMMENT ON COLUMN user_ingredient_replacements.user_id IS 'Utilisateur concerné par ce remplacement';
COMMENT ON COLUMN user_ingredient_replacements.original_ingredient_id IS 'Ingrédient à remplacer';
COMMENT ON COLUMN user_ingredient_replacements.replacement_ingredient_id IS 'Ingrédient de remplacement';

-- Migration: Ajouter le système de favoris
-- Exécuter sur Neon

-- Ajouter la colonne favorite_dishes aux utilisateurs
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_dishes JSONB DEFAULT '[]';

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_users_favorite_dishes ON users USING GIN (favorite_dishes);

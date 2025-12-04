-- Migration: Système de foyer pour les couples/familles
-- Date: 2024-11-27

-- Table des foyers
CREATE TABLE IF NOT EXISTS households (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255), -- Nom du foyer (optionnel, ex: "Famille Dupont")
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invite_code VARCHAR(20) UNIQUE, -- Code d'invitation unique
  invite_code_expires_at TIMESTAMP, -- Expiration du code (optionnel)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajouter la référence au foyer dans users
ALTER TABLE users ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE SET NULL;

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_users_household ON users(household_id);
CREATE INDEX IF NOT EXISTS idx_households_invite_code ON households(invite_code);

-- Commenter les colonnes
COMMENT ON TABLE households IS 'Foyers regroupant plusieurs utilisateurs (couples, familles)';
COMMENT ON COLUMN households.name IS 'Nom du foyer (optionnel)';
COMMENT ON COLUMN households.created_by IS 'Utilisateur qui a créé le foyer';
COMMENT ON COLUMN households.invite_code IS 'Code unique pour inviter des membres';
COMMENT ON COLUMN households.invite_code_expires_at IS 'Date d expiration du code d invitation';
COMMENT ON COLUMN users.household_id IS 'Foyer auquel appartient l utilisateur';

-- Fonction pour générer un code d'invitation unique
-- Note: Cette fonction sera utilisée par l'API, pas directement en SQL

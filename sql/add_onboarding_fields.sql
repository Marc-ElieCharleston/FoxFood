-- Migration: Ajout des champs pour l'onboarding utilisateur
-- Date: 2024-11-27

-- Ajouter le champ onboarding_completed pour savoir si l'utilisateur a terminé le setup initial
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Ajouter le nombre de personnes dans le foyer (impact sur les quantités d'ingrédients)
ALTER TABLE users ADD COLUMN IF NOT EXISTS household_size INTEGER DEFAULT 1;

-- Ajouter le flag d'acceptation du supplément (si > 4 personnes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_fee_accepted BOOLEAN DEFAULT false;

-- Ajouter la date d'acceptation du supplément
ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_fee_accepted_at TIMESTAMP;

-- Commenter les colonnes
COMMENT ON COLUMN users.onboarding_completed IS 'Indique si l utilisateur a complete le formulaire de bienvenue';
COMMENT ON COLUMN users.household_size IS 'Nombre de personnes dans le foyer (impact quantites ingredients)';
COMMENT ON COLUMN users.extra_fee_accepted IS 'Acceptation du supplement de 20 euros par semaine si plus de 4 personnes';
COMMENT ON COLUMN users.extra_fee_accepted_at IS 'Date d acceptation du supplement tarifaire';

-- Mettre à jour les utilisateurs existants qui ont déjà configuré leurs paramètres
UPDATE users SET onboarding_completed = true WHERE settings_completed = true;

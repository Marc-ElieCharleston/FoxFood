-- Migration: Ajouter la colonne selected_variants aux selections
-- Stocke les variantes choisies par le client pour chaque plat

-- Ajouter la colonne si elle n'existe pas
ALTER TABLE weekly_selections
ADD COLUMN IF NOT EXISTS selected_variants JSONB DEFAULT '{}';

-- Commentaire pour documenter le format
COMMENT ON COLUMN weekly_selections.selected_variants IS 'Format: { "dish_id": variant_id, ... }';

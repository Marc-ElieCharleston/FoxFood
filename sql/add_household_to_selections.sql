-- Migration: Lier les sélections au foyer plutôt qu'à l'utilisateur individuel
-- Cela permet aux membres d'un même foyer de partager la même sélection hebdomadaire

-- 1. Ajouter la colonne household_id
ALTER TABLE weekly_selections
ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE SET NULL;

-- 2. Mettre à jour les sélections existantes avec le household_id de l'utilisateur
UPDATE weekly_selections ws
SET household_id = u.household_id
FROM users u
WHERE ws.user_id = u.id
AND u.household_id IS NOT NULL;

-- 3. Ajouter la colonne last_modified_by pour savoir quel membre a fait la dernière modification
ALTER TABLE weekly_selections
ADD COLUMN IF NOT EXISTS last_modified_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 4. Mettre à jour last_modified_by avec user_id pour les enregistrements existants
UPDATE weekly_selections
SET last_modified_by = user_id
WHERE last_modified_by IS NULL;

-- 5. Créer un index sur household_id pour de meilleures performances
CREATE INDEX IF NOT EXISTS idx_weekly_selections_household_id ON weekly_selections(household_id);

-- Note: On garde la contrainte unique sur (user_id, week_start_date) pour le moment
-- car certains utilisateurs peuvent ne pas avoir de foyer.
-- La logique métier dans l'API gérera la priorité foyer vs utilisateur.

-- 6. Ajouter une contrainte unique sur (household_id, week_start_date) pour les sélections par foyer
-- D'abord, nettoyer les doublons potentiels (garder la plus récente)
DELETE FROM weekly_selections a
USING weekly_selections b
WHERE a.household_id = b.household_id
  AND a.week_start_date = b.week_start_date
  AND a.household_id IS NOT NULL
  AND a.id < b.id;

-- Maintenant créer la contrainte (si elle n'existe pas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_selections_household_week_unique'
  ) THEN
    ALTER TABLE weekly_selections
    ADD CONSTRAINT weekly_selections_household_week_unique
    UNIQUE (household_id, week_start_date);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- La contrainte existe déjà ou autre erreur, on continue
  RAISE NOTICE 'Contrainte non ajoutée: %', SQLERRM;
END $$;

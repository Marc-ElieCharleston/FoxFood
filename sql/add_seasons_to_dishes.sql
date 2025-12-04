-- Migration: Ajouter les saisons aux plats
-- Les plats peuvent etre associes a une ou plusieurs saisons

-- 1. Ajouter la colonne season (JSONB pour supporter plusieurs saisons)
ALTER TABLE dishes
ADD COLUMN IF NOT EXISTS seasons JSONB DEFAULT '["toutes"]';

-- 2. Mettre a jour les plats existants avec "toutes" saisons par defaut
UPDATE dishes
SET seasons = '["toutes"]'
WHERE seasons IS NULL;

-- 3. Creer un index pour les recherches par saison
CREATE INDEX IF NOT EXISTS idx_dishes_seasons ON dishes USING GIN (seasons);

-- Note: Les valeurs possibles pour seasons sont:
-- "printemps" - Mars, Avril, Mai
-- "ete" - Juin, Juillet, Aout
-- "automne" - Septembre, Octobre, Novembre
-- "hiver" - Decembre, Janvier, Fevrier
-- "toutes" - Disponible toute l'annee

-- Exemple de requete pour filtrer par saison:
-- SELECT * FROM dishes WHERE seasons @> '["printemps"]' OR seasons @> '["toutes"]';

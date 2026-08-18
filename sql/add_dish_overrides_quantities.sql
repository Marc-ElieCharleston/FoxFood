-- Extension des surcharges par plat : ajout d'ingrédients et quantités personnalisées
--
-- Jusqu'ici un override savait masquer, renommer, retirer et substituer — mais une
-- substitution héritait TOUJOURS de la quantité d'origine, et rien ne permettait
-- d'ajouter un ingrédient. Les adaptations de Mme Cherchemont en ont besoin :
-- « retirer la pâte à lasagne et ajouter 100 g de courgette », « perles de konjac
-- 100 g », « doubler les pois chiches ».

-- Ingrédients ajoutés à la recette pour ce client : [{ingredient_id, quantity, unit}]
-- Si l'ingrédient est déjà dans la recette (et dans la même unité), les quantités
-- s'additionnent — c'est ainsi qu'on exprime « +100 g de courgette ».
ALTER TABLE user_dish_overrides
  ADD COLUMN IF NOT EXISTS add_ingredients JSONB DEFAULT '[]';

COMMENT ON COLUMN user_dish_overrides.add_ingredients IS
  'Ingrédients ajoutés pour ce client [{ingredient_id, quantity, unit}] ; additionnés si déjà présents dans la même unité';

-- Rappel du format étendu de substitute_ingredients (pas de changement de type) :
--   [{from_ingredient_id, to_ingredient_id, quantity?, unit?}]
-- quantity/unit facultatifs : renseignés, ils remplacent la quantité d'origine.
COMMENT ON COLUMN user_dish_overrides.substitute_ingredients IS
  'Substitutions [{from_ingredient_id, to_ingredient_id, quantity?, unit?}] ; quantity/unit facultatifs remplacent la quantité d''origine';

-- Description personnalisée : le texte sous le nom du plat décrivait toujours la
-- recette du catalogue (« ... et cheddar », « ... pommes de terre grenailles »),
-- alors que le client reçoit autre chose. Le nom était adapté, pas la phrase.
ALTER TABLE user_dish_overrides
  ADD COLUMN IF NOT EXISTS custom_description TEXT;

COMMENT ON COLUMN user_dish_overrides.custom_description IS
  'Description affichée à ce client (null = description du catalogue)';

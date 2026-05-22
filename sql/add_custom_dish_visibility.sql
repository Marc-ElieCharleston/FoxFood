-- Restreint la visibilité des plats personnalisés à l'utilisateur qui les a demandés
-- Un plat avec created_for_user_id NULL est public (catalogue partagé)
-- Un plat avec created_for_user_id renseigné n'apparaît que pour cet utilisateur (et l'admin)

ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS created_for_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dishes_created_for_user ON dishes(created_for_user_id);

COMMENT ON COLUMN dishes.created_for_user_id IS 'NULL = plat public. Sinon = plat personnalisé visible uniquement par cet utilisateur (et l''admin).';

-- Rétroactif : lier les plats personnalisés déjà créés à l'utilisateur qui les a demandés.
-- Match par nom exact + marqueur "(Plat personnalisé)" dans la description.
UPDATE dishes d
SET created_for_user_id = cdr.user_id
FROM custom_dish_requests cdr
WHERE d.created_for_user_id IS NULL
  AND d.description LIKE '%Plat personnalisé%'
  AND d.name = cdr.dish_name;

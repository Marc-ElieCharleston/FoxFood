-- Ajout du support pour numéros de téléphone secondaires (couples)

-- Ajouter colonne pour numéro secondaire dans users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_phone_secondary VARCHAR(20);

-- Ajouter colonne pour numéro secondaire dans admin_settings
ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS notification_phone_secondary VARCHAR(20);

-- Commenter les colonnes
COMMENT ON COLUMN users.notification_phone_secondary IS 'Numéro de téléphone secondaire pour les couples (notifications SMS)';
COMMENT ON COLUMN admin_settings.notification_phone_secondary IS 'Numéro de téléphone secondaire admin pour notifications SMS';

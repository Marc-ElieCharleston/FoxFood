-- Ajouter les colonnes de paramètres utilisateur
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_day VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_time_slot VARCHAR(20); -- 'morning' or 'afternoon'
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER; -- 1-5 days
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_method VARCHAR(20) DEFAULT 'email'; -- 'sms' or 'email'
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS receive_notifications BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings_completed BOOLEAN DEFAULT false;

-- Mettre à jour les utilisateurs existants pour marquer leurs paramètres comme non complétés
UPDATE users SET settings_completed = false WHERE settings_completed IS NULL;

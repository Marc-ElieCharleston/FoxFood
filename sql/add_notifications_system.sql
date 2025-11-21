-- ============================================
-- SYSTÈME DE NOTIFICATIONS COMPLET
-- ============================================

-- 1. Table des rappels utilisateurs (multiples par user)
CREATE TABLE IF NOT EXISTS user_reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  days_before INTEGER NOT NULL CHECK (days_before IN (1, 3, 5)),
  enabled BOOLEAN DEFAULT true,
  send_email BOOLEAN DEFAULT true,
  send_sms BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, days_before)
);

-- 2. Table des demandes de plats personnalisés
CREATE TABLE IF NOT EXISTS custom_dish_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  dish_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  suggested_ingredients JSONB DEFAULT '[]',
  is_detailed BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table des paramètres admin
CREATE TABLE IF NOT EXISTS admin_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  notification_email VARCHAR(255),
  notification_phone VARCHAR(20),
  send_email BOOLEAN DEFAULT true,
  send_sms BOOLEAN DEFAULT false,

  -- Types de notifications à recevoir
  notify_on_selection BOOLEAN DEFAULT true,
  notify_on_missing_selection BOOLEAN DEFAULT true,
  notify_on_custom_dish BOOLEAN DEFAULT true,
  daily_summary BOOLEAN DEFAULT false,

  -- Configuration rappel automatique
  auto_reminder_days_before INTEGER DEFAULT 2 CHECK (auto_reminder_days_before BETWEEN 1 AND 5),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table de log des notifications envoyées
CREATE TABLE IF NOT EXISTS notifications_log (
  id SERIAL PRIMARY KEY,
  notification_type VARCHAR(50) NOT NULL,
  recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  method VARCHAR(10) CHECK (method IN ('email', 'sms', 'both')),
  subject VARCHAR(255),
  content TEXT,
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Créer un index sur les colonnes fréquemment utilisées
CREATE INDEX IF NOT EXISTS idx_user_reminders_user_id ON user_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_requests_user_id ON custom_dish_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_requests_status ON custom_dish_requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_log_user_id ON notifications_log(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_sent_at ON notifications_log(sent_at);

-- 6. Initialiser les paramètres admin pour les admins existants
INSERT INTO admin_settings (user_id, notification_email, send_email)
SELECT id, email, true
FROM users
WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

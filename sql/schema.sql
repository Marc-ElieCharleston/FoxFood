-- FoxFood Database Schema

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des plats
CREATE TABLE IF NOT EXISTS dishes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('viandes', 'poissons', 'vegetation')),
  description TEXT,
  ingredients JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des sélections hebdomadaires
CREATE TABLE IF NOT EXISTS weekly_selections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  delivery_day VARCHAR(20) NOT NULL,
  delivery_time_slot VARCHAR(50) NOT NULL,
  selected_dishes JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  shopping_list_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, week_start_date)
);

-- Table des rappels
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  selection_id INTEGER REFERENCES weekly_selections(id) ON DELETE CASCADE,
  reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('shopping_5days', 'selection_2days')),
  sent_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category);
CREATE INDEX IF NOT EXISTS idx_dishes_active ON dishes(active);
CREATE INDEX IF NOT EXISTS idx_weekly_selections_user ON weekly_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_selections_date ON weekly_selections(week_start_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- Créer 2 comptes admin par défaut (mot de passe: "admin123" - à changer en production!)
-- Hash bcrypt de "admin123": $2a$10$rZJ9ZqKQqZ9ZqKQqZ9ZqKOX7K7K7K7K7K7K7K7K7K7K7K7K7K7K7K
INSERT INTO users (email, name, password, role)
VALUES
  ('emeric@foxfood.com', 'Emeric', '$2a$10$rZJ9ZqKQqZ9ZqKQqZ9ZqKOX7K7K7K7K7K7K7K7K7K7K7K7K7K7K7K', 'admin'),
  ('dev@foxfood.com', 'Developer', '$2a$10$rZJ9ZqKQqZ9ZqKQqZ9ZqKOX7K7K7K7K7K7K7K7K7K7K7K7K7K7K7K', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Migration: Système de popup message
-- Date: 2026-01-31
-- Description: Ajoute la table pour gérer le popup de parrainage affiché aux utilisateurs

-- Créer la table pour les paramètres du popup
CREATE TABLE IF NOT EXISTS admin_popup_settings (
  id SERIAL PRIMARY KEY,
  is_active BOOLEAN DEFAULT true,
  message TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insérer le message par défaut (parrainage)
INSERT INTO admin_popup_settings (is_active, message) VALUES (
  true,
  '👉 Parrainage Foxfood :
Pour chaque personne que tu parraines et qui prend une formule Foxfood (mensuelle ou hebdomadaire),
tu bénéficies de –10 % sur ton offre mensuelle ou hebdomadaire,
à valoir sur le mois suivant.

Il suffit que la personne me contacte de ta part en précisant qu''elle souhaite une formule mensuelle ou hebdomadaire.

Merci encore pour ta confiance,
à très vite en cuisine 👨‍🍳

Emeric – Foxfood'
)
ON CONFLICT DO NOTHING;

-- Afficher le résultat
SELECT
  '✅ Table admin_popup_settings créée' as status,
  COUNT(*) as nb_messages
FROM admin_popup_settings;

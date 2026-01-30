import { sql } from '@vercel/postgres'

/**
 * Système de migrations automatiques
 * Chaque migration s'exécute une seule fois
 */

// Table pour tracker les migrations exécutées
async function ensureMigrationsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    return true
  } catch (error) {
    console.error('Erreur création table migrations:', error)
    return false
  }
}

// Vérifier si une migration a déjà été exécutée
async function isMigrationExecuted(name) {
  try {
    const result = await sql`
      SELECT id FROM _migrations WHERE name = ${name}
    `
    return result.rows.length > 0
  } catch (error) {
    console.error('Erreur vérification migration:', error)
    return false
  }
}

// Marquer une migration comme exécutée
async function markMigrationExecuted(name) {
  try {
    await sql`
      INSERT INTO _migrations (name) VALUES (${name})
      ON CONFLICT (name) DO NOTHING
    `
    return true
  } catch (error) {
    console.error('Erreur marquage migration:', error)
    return false
  }
}

// Liste des migrations à exécuter
const migrations = [
  {
    name: '2024-01-28-add-ingredient-replacements',
    up: async () => {
      // Créer la table des remplacements
      await sql`
        CREATE TABLE IF NOT EXISTS user_ingredient_replacements (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          original_ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
          replacement_ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, original_ingredient_id)
        )
      `

      // Index pour performance
      await sql`
        CREATE INDEX IF NOT EXISTS idx_user_ingredient_replacements_user
        ON user_ingredient_replacements(user_id)
      `

      // Ajouter les ingrédients manquants
      await sql`
        INSERT INTO ingredients (name, default_unit, dietary_tags, category) VALUES
          ('Lait de soja', 'ml', '["soja"]', 'produit_laitier'),
          ('Crème de soja', 'ml', '["soja"]', 'produit_laitier'),
          ('Maïzena', 'g', '[]', 'feculent')
        ON CONFLICT (name) DO NOTHING
      `

      console.log('✅ Migration: Système de remplacement d\'ingrédients créé')
    }
  },
  {
    name: '2026-01-30-add-popup-message',
    up: async () => {
      // Créer la table pour les paramètres du popup
      await sql`
        CREATE TABLE IF NOT EXISTS admin_popup_settings (
          id SERIAL PRIMARY KEY,
          is_active BOOLEAN DEFAULT true,
          message TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `

      // Insérer le message par défaut
      await sql`
        INSERT INTO admin_popup_settings (is_active, message) VALUES (
          true,
          '👉 Parrainage Foxfood :
Pour chaque personne que tu parraines et qui prend une formule Foxfood (mensuelle ou hebdomadaire),
tu bénéficies de –10 % sur ton offre mensuelle ou hebdomadaire,
à valoir sur le mois suivant.

Il suffit que la personne me contacte de ta part en précisant qu'elle souhaite une formule mensuelle ou hebdomadaire.

Merci encore pour ta confiance,
à très vite en cuisine 👨‍🍳

Emeric – Foxfood'
        )
        ON CONFLICT DO NOTHING
      `

      console.log('✅ Migration: Système de popup de parrainage créé')
    }
  }
]

/**
 * Exécuter toutes les migrations en attente
 */
export async function runMigrations() {
  console.log('🔄 Vérification des migrations...')

  try {
    // S'assurer que la table de migrations existe
    const tableCreated = await ensureMigrationsTable()
    if (!tableCreated) {
      console.error('❌ Impossible de créer la table de migrations')
      return false
    }

    // Exécuter chaque migration si elle n'a pas déjà été exécutée
    for (const migration of migrations) {
      const executed = await isMigrationExecuted(migration.name)

      if (!executed) {
        console.log(`⏳ Exécution de la migration: ${migration.name}`)
        try {
          await migration.up()
          await markMigrationExecuted(migration.name)
          console.log(`✅ Migration réussie: ${migration.name}`)
        } catch (error) {
          console.error(`❌ Erreur migration ${migration.name}:`, error)
          // Continuer avec les autres migrations
        }
      } else {
        console.log(`⏭️  Migration déjà exécutée: ${migration.name}`)
      }
    }

    console.log('✅ Migrations terminées')
    return true
  } catch (error) {
    console.error('❌ Erreur système de migrations:', error)
    return false
  }
}

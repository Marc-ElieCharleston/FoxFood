/**
 * Script pour exécuter les migrations manuellement
 * Usage: node scripts/run-migrations.js
 */

import { sql } from '@vercel/postgres'

async function runMigrations() {
  console.log('🔄 Démarrage des migrations...\n')

  try {
    // 1. Créer la table _migrations pour tracker les migrations
    console.log('📝 Création de la table _migrations...')
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    console.log('✅ Table _migrations prête\n')

    // 2. Vérifier si la migration a déjà été exécutée
    const migrationName = '2024-01-28-add-ingredient-replacements'
    const check = await sql`
      SELECT id FROM _migrations WHERE name = ${migrationName}
    `

    if (check.rows.length > 0) {
      console.log(`⏭️  Migration "${migrationName}" déjà exécutée\n`)
      return
    }

    console.log(`⏳ Exécution de la migration: ${migrationName}\n`)

    // 3. Créer la table user_ingredient_replacements
    console.log('📝 Création de la table user_ingredient_replacements...')
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
    console.log('✅ Table créée\n')

    // 4. Créer l'index
    console.log('📝 Création de l\'index...')
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_ingredient_replacements_user
      ON user_ingredient_replacements(user_id)
    `
    console.log('✅ Index créé\n')

    // 5. Ajouter les ingrédients manquants
    console.log('📝 Ajout des ingrédients manquants...')
    await sql`
      INSERT INTO ingredients (name, default_unit, dietary_tags, category) VALUES
        ('Lait de soja', 'ml', '["soja"]', 'produit_laitier'),
        ('Crème de soja', 'ml', '["soja"]', 'produit_laitier'),
        ('Maïzena', 'g', '[]', 'feculent')
      ON CONFLICT (name) DO NOTHING
    `
    console.log('✅ Ingrédients ajoutés\n')

    // 6. Marquer la migration comme exécutée
    console.log('📝 Marquage de la migration comme exécutée...')
    await sql`
      INSERT INTO _migrations (name) VALUES (${migrationName})
    `
    console.log('✅ Migration marquée\n')

    // 7. Vérifier que tout est OK
    console.log('🔍 Vérification...')
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'user_ingredient_replacements'
    `

    const ingredientsCheck = await sql`
      SELECT name FROM ingredients
      WHERE name IN ('Lait de soja', 'Crème de soja', 'Maïzena')
      ORDER BY name
    `

    console.log('\n📊 Résumé:')
    console.log(`  ✅ Table user_ingredient_replacements: ${tableCheck.rows.length > 0 ? 'EXISTS' : 'NOT FOUND'}`)
    console.log(`  ✅ Ingrédients ajoutés: ${ingredientsCheck.rows.length}/3`)
    if (ingredientsCheck.rows.length > 0) {
      ingredientsCheck.rows.forEach(row => {
        console.log(`     - ${row.name}`)
      })
    }

    console.log('\n🎉 Migrations terminées avec succès!')

  } catch (error) {
    console.error('\n❌ Erreur lors des migrations:', error)
    process.exit(1)
  }

  process.exit(0)
}

runMigrations()

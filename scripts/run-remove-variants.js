#!/usr/bin/env node
/**
 * Migration: Suppression du système de variantes
 * - Crée la table dish_ingredients (lien direct plat → ingrédient)
 * - Ajoute dietary_tags sur dishes
 * - Migre les données depuis variant_ingredients (variantes par défaut)
 * - Migre les dietary_tags depuis les variantes par défaut vers dishes
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

async function run() {
  console.log('🔄 Migration: Suppression des variantes\n')

  // 1. Créer la table dish_ingredients
  console.log('📦 Étape 1: Création de la table dish_ingredients...')
  try {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS dish_ingredients (
        id SERIAL PRIMARY KEY,
        dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
        unit VARCHAR(20),
        notes VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(dish_id, ingredient_id)
      )
    `)
    console.log('✅ Table dish_ingredients créée')
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('⊘ Table dish_ingredients déjà existante')
    } else {
      console.log(`⚠️  Erreur création table: ${err.message.substring(0, 80)}`)
    }
  }

  // Créer les index
  try {
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_dish_ingredients_dish ON dish_ingredients(dish_id)`)
    console.log('✅ Index idx_dish_ingredients_dish créé')
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('⊘ Index idx_dish_ingredients_dish déjà existant')
    } else {
      console.log(`⚠️  Erreur index dish: ${err.message.substring(0, 80)}`)
    }
  }

  try {
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_dish_ingredients_ingredient ON dish_ingredients(ingredient_id)`)
    console.log('✅ Index idx_dish_ingredients_ingredient créé')
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('⊘ Index idx_dish_ingredients_ingredient déjà existant')
    } else {
      console.log(`⚠️  Erreur index ingredient: ${err.message.substring(0, 80)}`)
    }
  }

  // 2. Ajouter dietary_tags sur dishes
  console.log('\n📦 Étape 2: Ajout colonne dietary_tags sur dishes...')
  try {
    await sql.query(`ALTER TABLE dishes ADD COLUMN IF NOT EXISTS dietary_tags JSONB DEFAULT '[]'`)
    console.log('✅ Colonne dietary_tags ajoutée sur dishes')
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('⊘ Colonne dietary_tags déjà existante')
    } else {
      console.log(`⚠️  Erreur ajout colonne: ${err.message.substring(0, 80)}`)
    }
  }

  // 3. Migrer les ingrédients des variantes par défaut vers dish_ingredients
  console.log('\n📦 Étape 3: Migration des ingrédients (variantes par défaut → dish_ingredients)...')
  try {
    const result = await sql.query(`
      INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity, unit, notes)
      SELECT DISTINCT dv.dish_id, vi.ingredient_id, vi.quantity, vi.unit, vi.notes
      FROM variant_ingredients vi
      JOIN dish_variants dv ON vi.variant_id = dv.id
      WHERE dv.is_default = true
      ON CONFLICT (dish_id, ingredient_id) DO NOTHING
    `)
    console.log(`✅ ${result.rowCount} ingrédients migrés vers dish_ingredients`)
  } catch (err) {
    console.log(`⚠️  Erreur migration ingrédients: ${err.message.substring(0, 80)}`)
  }

  // 4. Migrer les dietary_tags des variantes par défaut vers dishes
  console.log('\n📦 Étape 4: Migration des dietary_tags (variantes par défaut → dishes)...')
  try {
    const result = await sql.query(`
      UPDATE dishes d
      SET dietary_tags = COALESCE(dv.tags, '[]'::jsonb)
      FROM dish_variants dv
      WHERE dv.dish_id = d.id
        AND dv.is_default = true
        AND dv.tags IS NOT NULL
        AND dv.tags != '[]'::jsonb
    `)
    console.log(`✅ ${result.rowCount} plats mis à jour avec les dietary_tags`)
  } catch (err) {
    console.log(`⚠️  Erreur migration dietary_tags: ${err.message.substring(0, 80)}`)
  }

  // Résumé
  console.log('\n📊 Résumé:')
  try {
    const dishIngCount = await sql`SELECT COUNT(*) as count FROM dish_ingredients`
    console.log(`  dish_ingredients: ${dishIngCount.rows[0].count} lignes`)
  } catch (err) {
    console.log(`  dish_ingredients: impossible de compter`)
  }

  try {
    const taggedCount = await sql`SELECT COUNT(*) as count FROM dishes WHERE dietary_tags != '[]'::jsonb`
    console.log(`  Plats avec dietary_tags: ${taggedCount.rows[0].count}`)
  } catch (err) {
    console.log(`  Plats avec dietary_tags: impossible de compter`)
  }

  console.log('\n✅ Migration suppression des variantes terminée!')
  process.exit(0)
}

run().catch(err => {
  console.error('❌ Erreur:', err.message)
  process.exit(1)
})

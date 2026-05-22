#!/usr/bin/env node

require('dotenv').config()
const { sql } = require('@vercel/postgres')

async function main() {
  console.log('\n=== Migration: visibilité des plats personnalisés ===\n')

  // Diagnostic avant (sans référencer la colonne qui peut ne pas exister encore)
  const beforeCol = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'created_for_user_id'
  `
  console.log(`Colonne created_for_user_id présente avant: ${beforeCol.rows.length > 0}`)

  const customDishesBefore = await sql`
    SELECT id, name, category
    FROM dishes
    WHERE description LIKE '%Plat personnalisé%'
    ORDER BY id
  `
  console.log(`Plats personnalisés existants dans dishes: ${customDishesBefore.rows.length}`)
  customDishesBefore.rows.forEach(d => {
    console.log(`  - [${d.id}] ${d.name} (cat=${d.category})`)
  })

  // 1) ALTER TABLE
  console.log('\n→ Ajout colonne created_for_user_id...')
  await sql`
    ALTER TABLE dishes
      ADD COLUMN IF NOT EXISTS created_for_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  `
  console.log('  ✓ Colonne ajoutée (ou déjà existante)')

  // 2) INDEX
  console.log('\n→ Création de l\'index...')
  await sql`
    CREATE INDEX IF NOT EXISTS idx_dishes_created_for_user ON dishes(created_for_user_id)
  `
  console.log('  ✓ Index créé (ou déjà existant)')

  // 3) COMMENT
  console.log('\n→ Pose du commentaire sur la colonne...')
  await sql`
    COMMENT ON COLUMN dishes.created_for_user_id IS 'NULL = plat public. Sinon = plat personnalisé visible uniquement par cet utilisateur (et l''admin).'
  `
  console.log('  ✓ Commentaire posé')

  // 4) Backfill rétroactif
  console.log('\n→ Backfill rétroactif (lien plat ↔ demandeur)...')
  const backfill = await sql`
    UPDATE dishes d
    SET created_for_user_id = cdr.user_id
    FROM custom_dish_requests cdr
    WHERE d.created_for_user_id IS NULL
      AND d.description LIKE '%Plat personnalisé%'
      AND d.name = cdr.dish_name
    RETURNING d.id, d.name, d.created_for_user_id
  `
  console.log(`  ✓ ${backfill.rows.length} plat(s) lié(s) à leur demandeur`)
  backfill.rows.forEach(d => {
    console.log(`    - [${d.id}] ${d.name} → user ${d.created_for_user_id}`)
  })

  // Diagnostic après
  console.log('\n=== Diagnostic après migration ===')
  const after = await sql`
    SELECT d.id, d.name, d.category, d.created_for_user_id, u.name as owner_name, u.email as owner_email
    FROM dishes d
    LEFT JOIN users u ON u.id = d.created_for_user_id
    WHERE d.description LIKE '%Plat personnalisé%'
    ORDER BY d.id
  `
  console.log(`\nPlats personnalisés dans dishes: ${after.rows.length}`)
  after.rows.forEach(d => {
    const owner = d.created_for_user_id
      ? `${d.owner_name || '(no name)'} <${d.owner_email}>`
      : 'PUBLIC (orphelin)'
    console.log(`  - [${d.id}] ${d.name} (cat=${d.category}) → ${owner}`)
  })

  const orphans = after.rows.filter(d => d.created_for_user_id === null)
  if (orphans.length > 0) {
    console.log(`\n⚠️  ${orphans.length} plat(s) personnalisé(s) orphelin(s) — aucune demande correspondante trouvée.`)
    console.log('   Ils restent visibles par tous (NULL = public). À examiner manuellement.')
  }

  console.log('\n✓ Migration terminée\n')
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ ERREUR:', err.message)
  console.error(err)
  process.exit(1)
})

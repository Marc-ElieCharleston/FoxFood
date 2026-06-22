#!/usr/bin/env node
/**
 * Applique la migration sql/add_password_reset_tokens.sql.
 *
 * Cette migration a été oubliée lors du déploiement initial, ce qui a empêché
 * la fonctionnalité "Mot de passe oublié ?" de fonctionner pendant plusieurs mois :
 * le code écrivait dans une table inexistante et échouait silencieusement
 * (l'utilisateur recevait le message générique "si l'email existe vous recevrez un lien"
 * sans qu'aucun email ne soit envoyé).
 *
 * Idempotent — peut être relancé sans risque.
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

async function main() {
  console.log('Migration password_reset_tokens...')

  await sql.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('  ✓ Table password_reset_tokens créée (ou déjà existante)')

  await sql.query('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)')
  await sql.query('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)')
  await sql.query('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at)')
  console.log('  ✓ Index créés')

  // Vérification
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'password_reset_tokens'
    ORDER BY ordinal_position
  `
  if (cols.rows.length === 0) {
    console.log('  ❌ Table introuvable après création')
    process.exit(1)
  }
  console.log('  Colonnes :', cols.rows.map(c => c.column_name).join(', '))

  // Normalisation des emails (case-insensitive)
  const upd = await sql`
    UPDATE users SET email = LOWER(email), updated_at = CURRENT_TIMESTAMP
    WHERE email != LOWER(email)
    RETURNING id
  `
  if (upd.rows.length > 0) {
    console.log(`  ✓ ${upd.rows.length} email(s) normalisé(s) en lowercase`)
  } else {
    console.log('  ✓ Tous les emails sont déjà en lowercase')
  }

  console.log('\n✅ Migration appliquée.')
  process.exit(0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })

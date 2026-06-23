#!/usr/bin/env node
/**
 * Génère un lien de réinitialisation de mot de passe pour un utilisateur,
 * sans dépendre de l'envoi d'email (utile tant que Resend FROM_EMAIL n'est
 * pas configuré sur un domaine vérifié).
 *
 * Le lien est à transmettre manuellement à l'utilisateur (WhatsApp, SMS…).
 *
 * Usage:
 *   node scripts/generate-reset-link.js <email|partial_name>
 *
 * Examples:
 *   node scripts/generate-reset-link.js marlouunter@hotmail.com
 *   node scripts/generate-reset-link.js denis
 */
require('dotenv').config()
const crypto = require('crypto')
const { sql } = require('@vercel/postgres')

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: node scripts/generate-reset-link.js <email|partial_name>')
    process.exit(1)
  }

  // Chercher le user
  const q = arg.includes('@')
    ? sql`SELECT id, email, name FROM users WHERE LOWER(email) = ${arg.toLowerCase()} LIMIT 5`
    : sql`SELECT id, email, name FROM users WHERE LOWER(name) LIKE ${'%' + arg.toLowerCase() + '%'} OR LOWER(email) LIKE ${'%' + arg.toLowerCase() + '%'} LIMIT 5`
  const r = await q

  if (r.rows.length === 0) {
    console.error(`Aucun utilisateur trouvé pour "${arg}"`)
    process.exit(1)
  }
  if (r.rows.length > 1) {
    console.error(`Plusieurs utilisateurs correspondent. Précise l'email exact :`)
    r.rows.forEach(u => console.error(`  [${u.id}] ${u.name} → ${u.email}`))
    process.exit(1)
  }

  const user = r.rows[0]
  console.log(`Utilisateur : [${user.id}] ${user.name} (${user.email})`)

  // Réutiliser un token actif si dispo
  const existing = await sql`
    SELECT token, expires_at FROM password_reset_tokens
    WHERE user_id = ${user.id} AND used_at IS NULL AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
  `
  let token, expiresAt
  if (existing.rows.length > 0) {
    token = existing.rows[0].token
    expiresAt = existing.rows[0].expires_at
    console.log('Token actif existant réutilisé.')
  } else {
    token = crypto.randomBytes(32).toString('hex')
    expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)
    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt})
    `
    console.log('Nouveau token généré (valide 24h).')
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  console.log()
  console.log('═══ Lien de réinitialisation ═══')
  console.log(`  ${baseUrl}/reset-password?token=${token}`)
  console.log()
  console.log(`Expire le : ${expiresAt instanceof Date ? expiresAt.toLocaleString('fr-FR') : new Date(expiresAt).toLocaleString('fr-FR')}`)
  console.log()
  console.log('⚠️ NEXTAUTH_URL local =', baseUrl)
  console.log('   Si le lien ne marche pas, remplace la base par le vrai domaine prod.')

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })

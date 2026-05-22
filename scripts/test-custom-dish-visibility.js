#!/usr/bin/env node

require('dotenv').config()
const { sql } = require('@vercel/postgres')

// Simule la requête exécutée par /api/dishes GET pour un utilisateur donné
async function fetchDishesForUser(userId, isAdmin) {
  return await sql`
    SELECT id, name, category, created_for_user_id
    FROM dishes
    WHERE active = true
    AND (${isAdmin} OR created_for_user_id IS NULL OR created_for_user_id = ${userId})
    ORDER BY id
  `
}

async function main() {
  console.log('\n=== Test du filtrage de visibilité des plats personnalisés ===\n')

  // Récupérer 3 utilisateurs test
  const helena = (await sql`SELECT id, name, email, role FROM users WHERE email = 'helena.diprima@gmail.com' LIMIT 1`).rows[0]
  const marie = (await sql`SELECT id, name, email, role FROM users WHERE email = 'marie.cherchemont@gmail.com' LIMIT 1`).rows[0]
  const admin = (await sql`SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 1`).rows[0]

  // Trouve un client qui n'a aucun plat personnalisé
  const otherClient = (await sql`
    SELECT u.id, u.name, u.email, u.role FROM users u
    WHERE u.role = 'client'
      AND NOT EXISTS (
        SELECT 1 FROM dishes d WHERE d.created_for_user_id = u.id
      )
    LIMIT 1
  `).rows[0]

  // Total dishes
  const total = (await sql`SELECT COUNT(*)::int as n FROM dishes WHERE active = true`).rows[0].n
  const totalCustom = (await sql`SELECT COUNT(*)::int as n FROM dishes WHERE active = true AND created_for_user_id IS NOT NULL`).rows[0].n
  const totalPublic = total - totalCustom
  console.log(`Total plats actifs: ${total} (${totalPublic} publics + ${totalCustom} personnalisés)\n`)

  for (const u of [helena, marie, otherClient, admin]) {
    if (!u) { console.log('  (utilisateur introuvable)\n'); continue }
    const isAdmin = u.role === 'admin'
    const dishes = await fetchDishesForUser(u.id, isAdmin)
    const customSeen = dishes.rows.filter(d => d.created_for_user_id !== null)
    const myCustom = customSeen.filter(d => d.created_for_user_id === u.id)
    const othersCustom = customSeen.filter(d => d.created_for_user_id !== u.id)

    console.log(`👤 ${u.name} <${u.email}> [${u.role}] (id=${u.id})`)
    console.log(`   Voit ${dishes.rows.length}/${total} plats`)
    console.log(`   Plats personnalisés visibles: ${customSeen.length} (${myCustom.length} à lui + ${othersCustom.length} d'autres)`)

    if (!isAdmin && othersCustom.length > 0) {
      console.log(`   ❌ FUITE: voit des plats personnalisés d'autres clients:`)
      othersCustom.forEach(d => console.log(`      - [${d.id}] ${d.name} (owner=${d.created_for_user_id})`))
    } else if (isAdmin) {
      console.log(`   ✓ Admin voit tout (attendu)`)
    } else {
      console.log(`   ✓ Aucune fuite vers d'autres clients`)
    }

    if (!isAdmin && myCustom.length > 0) {
      console.log(`   Ses plats personnalisés:`)
      myCustom.forEach(d => console.log(`      - [${d.id}] ${d.name}`))
    }
    console.log()
  }

  // Vérification spécifique: le Colombo de veau ne doit PAS être visible par marie ni par otherClient
  console.log('🔍 Cas spécifique: "Colombo de veau" (dish 318, owner Héléna)')
  for (const u of [helena, marie, otherClient]) {
    if (!u) continue
    const seen = (await sql`
      SELECT 1 FROM dishes
      WHERE id = 318
      AND (${u.role === 'admin'} OR created_for_user_id IS NULL OR created_for_user_id = ${u.id})
    `).rows.length > 0
    const expected = (u.id === helena.id)
    const icon = seen === expected ? '✓' : '❌'
    console.log(`   ${icon} ${u.name}: voit=${seen}, attendu=${expected}`)
  }

  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ ERREUR:', err.message)
  console.error(err)
  process.exit(1)
})

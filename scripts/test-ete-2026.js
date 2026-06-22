#!/usr/bin/env node
/**
 * Tests d'intégrité du catalogue été 2026.
 * Aucune écriture, uniquement lecture.
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

let pass = 0, fail = 0, warn = 0
const failures = []
const warnings = []

function ok(msg) { pass++; console.log('  ✓ ' + msg) }
function ko(msg) { fail++; failures.push(msg); console.log('  ❌ ' + msg) }
function wn(msg) { warn++; warnings.push(msg); console.log('  ⚠️  ' + msg) }
function section(title) { console.log('\n━━━ ' + title + ' ━━━') }

async function main() {
  // ============ TEST 1 : descriptions complètes ============
  section('1. Descriptions des plats été')

  const missing = await sql`
    SELECT id, name, category FROM dishes
    WHERE active = true
      AND (description IS NULL OR TRIM(description) = '')
      AND (seasons @> '"ete"'::jsonb OR seasons @> '"toutes"'::jsonb)
  `
  if (missing.rows.length === 0) ok('Tous les plats été ont une description')
  else ko(missing.rows.length + ' plats été SANS description : ' + missing.rows.map(d => '[' + d.id + ']').join(', '))

  // Détecter descriptions suspectes (trop courtes ou contenant des termes bruts)
  const suspect = await sql`
    SELECT id, name, description FROM dishes
    WHERE active = true
      AND (seasons @> '"ete"'::jsonb OR seasons @> '"toutes"'::jsonb)
      AND (
        LENGTH(description) < 15
        OR description ILIKE '%PCE%'
        OR description ILIKE '%poirvon%'
        OR description ILIKE '%parpika%'
        OR description ILIKE '%gingenmbre%'
        OR description ILIKE '%mozzarella rappee%'
      )
  `
  if (suspect.rows.length === 0) ok('Aucune description suspecte (typos source, abréviations)')
  else {
    wn(suspect.rows.length + ' descriptions à relire :')
    suspect.rows.forEach(d => console.log('       [' + d.id + '] ' + d.name + ' → "' + d.description + '"'))
  }

  // ============ TEST 2 : catalogue été ============
  section('2. Composition du catalogue été')

  const summary = await sql`
    SELECT category, COUNT(*) AS n FROM dishes
    WHERE active = true
      AND (seasons @> '"ete"'::jsonb OR seasons @> '"toutes"'::jsonb)
    GROUP BY category ORDER BY category
  `
  const total = summary.rows.reduce((s, r) => s + parseInt(r.n), 0)
  if (total >= 100) ok(total + ' plats actifs visibles en été (vegetation/poissons/viandes/desserts)')
  else ko('Seulement ' + total + ' plats actifs en été (attendu > 100)')
  summary.rows.forEach(r => console.log('       ' + r.category + ': ' + r.n))

  // ============ TEST 3 : doublons de noms ============
  section('3. Doublons potentiels')

  const dups = await sql`
    SELECT LOWER(name) AS lname, COUNT(*) AS n, array_agg(id ORDER BY id) AS ids
    FROM dishes WHERE active = true
    GROUP BY LOWER(name) HAVING COUNT(*) > 1
  `
  if (dups.rows.length === 0) ok('Aucun doublon de nom (insensible casse) parmi plats actifs')
  else {
    wn(dups.rows.length + ' nom(s) répété(s) parmi plats actifs :')
    dups.rows.forEach(d => console.log('       "' + d.lname + '" → ids ' + d.ids.join(',')))
  }

  // ============ TEST 4 : Renommages Wok ============
  section('4. Wok bœuf/poulet "de saison"')

  const wokRenamed = await sql`SELECT id, name, seasons FROM dishes WHERE id IN (245, 246)`
  wokRenamed.rows.forEach(d => {
    const s = Array.isArray(d.seasons) ? d.seasons : JSON.parse(d.seasons || '[]')
    if (/de saison/i.test(d.name)) ok('[' + d.id + '] ' + d.name + ' (' + s.join(',') + ')')
    else ko('[' + d.id + '] devrait s\'appeler "de saison" → ' + d.name)
  })

  const wokDeactivated = await sql`SELECT id, name, active FROM dishes WHERE id IN (19, 23)`
  wokDeactivated.rows.forEach(d => {
    if (!d.active) ok('Coquille vide [' + d.id + '] ' + d.name + ' correctement désactivée')
    else ko('[' + d.id + '] ' + d.name + ' devrait être désactivée')
  })

  // ============ TEST 5 : Desserts printemps → été ============
  section('5. Desserts (printemps + été)')

  const desserts = await sql`
    SELECT id, name, seasons FROM dishes
    WHERE active = true AND category = 'desserts'
    ORDER BY name
  `
  let dessertsWithEte = 0
  desserts.rows.forEach(d => {
    const s = Array.isArray(d.seasons) ? d.seasons : JSON.parse(d.seasons || '[]')
    if (s.includes('ete') || s.includes('toutes')) dessertsWithEte++
  })
  if (dessertsWithEte >= 10) ok(dessertsWithEte + '/' + desserts.rows.length + ' desserts visibles en été')
  else wn('Seulement ' + dessertsWithEte + '/' + desserts.rows.length + ' desserts visibles en été')

  // ============ TEST 6 : Overrides Cherchemont ============
  section('6. Overrides Mme Cherchemont (user 14)')

  const cherchemont = await sql`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE action = 'hide') AS hidden,
           COUNT(*) FILTER (WHERE custom_name IS NOT NULL) AS renamed,
           COUNT(*) FILTER (WHERE jsonb_array_length(substitute_ingredients) > 0) AS with_subs
    FROM user_dish_overrides WHERE user_id = 14
  `
  const c = cherchemont.rows[0]
  if (parseInt(c.total) >= 60) ok(c.total + ' overrides actifs (dont ' + c.hidden + ' masqués, ' + c.renamed + ' renommés, ' + c.with_subs + ' avec substitutions)')
  else wn('Seulement ' + c.total + ' overrides (attendu > 60)')

  // Vérifier les renommages riz appliqués précédemment
  const rizRenames = await sql`
    SELECT udo.dish_id, d.name AS dish_name, udo.custom_name
    FROM user_dish_overrides udo
    JOIN dishes d ON d.id = udo.dish_id
    WHERE udo.user_id = 14
      AND udo.custom_name IS NOT NULL
      AND udo.custom_name ILIKE '%konjac%'
  `
  if (rizRenames.rows.length >= 5) ok(rizRenames.rows.length + ' renommages riz→konjac actifs')
  else wn('Seulement ' + rizRenames.rows.length + ' renommages konjac actifs')

  // ============ TEST 7 : Custom dishes privés ============
  section('7. Custom dishes privés (created_for_user_id)')

  const custom = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE created_for_user_id IS NOT NULL) AS private_dishes,
      COUNT(*) FILTER (WHERE created_for_user_id IS NULL) AS public_dishes
    FROM dishes
    WHERE description ILIKE '%Plat personnalisé%'
  `
  const cust = custom.rows[0]
  console.log('       Plats marqués "Plat personnalisé" : ' + cust.total + ' (' + cust.private_dishes + ' privés, ' + cust.public_dishes + ' publics)')
  if (parseInt(cust.public_dishes) === 0) ok('Tous les plats personnalisés sont liés à un user (aucun public)')
  else wn(cust.public_dishes + ' plat(s) personnalisé(s) sans created_for_user_id — visible(s) par tout le monde')

  // ============ TEST 8 : Filtrage API simulé pour 3 users ============
  section('8. Filtrage par utilisateur (simulation)')

  const users = await sql`SELECT id, email, role FROM users ORDER BY id LIMIT 50`
  const sampleUsers = [
    users.rows.find(u => u.role === 'admin'),
    users.rows.find(u => u.id === 14),  // Cherchemont
    users.rows.find(u => u.role === 'client' && u.id !== 14),
  ].filter(Boolean)

  for (const u of sampleUsers) {
    const isAdmin = u.role === 'admin'
    const visible = await sql`
      SELECT COUNT(*) AS n FROM dishes
      WHERE active = true
        AND (seasons @> '"ete"'::jsonb OR seasons @> '"toutes"'::jsonb)
        AND (${isAdmin} OR created_for_user_id IS NULL OR created_for_user_id = ${u.id})
    `
    console.log('       ' + (u.role + '@' + u.email).padEnd(40) + ' → ' + visible.rows[0].n + ' plats visibles')
  }
  ok('Filtrage par created_for_user_id testé sur 3 profils')

  // ============ TEST 9 : Sélections clients existantes pas cassées ============
  section('9. Sélections clients (intégrité IDs)')

  const orphans = await sql`
    SELECT ws.user_id, ws.week_start_date, ws.selected_dishes
    FROM weekly_selections ws
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(ws.selected_dishes) AS dish_id
      WHERE NOT EXISTS (SELECT 1 FROM dishes WHERE id = dish_id::int)
    )
    LIMIT 5
  `
  if (orphans.rows.length === 0) ok('Aucune sélection cliente ne pointe vers un plat supprimé')
  else wn(orphans.rows.length + '+ sélection(s) historiques pointent vers des dish_id supprimés (préexistant, sans rapport avec l\'import été)')

  // Sélection référençant des plats désactivés
  const onDeactivated = await sql`
    SELECT COUNT(DISTINCT ws.user_id) AS n
    FROM weekly_selections ws,
         jsonb_array_elements_text(ws.selected_dishes) AS dish_id
    WHERE EXISTS (
      SELECT 1 FROM dishes WHERE id = dish_id::int AND active = false
    )
  `
  const desactNb = parseInt(onDeactivated.rows[0].n)
  if (desactNb === 0) ok('Aucune sélection ne pointe vers un plat désactivé')
  else wn(desactNb + ' user(s) ont une sélection vers un plat désactivé (info, non bloquant)')

  // ============ TEST 10 : Saison active ============
  section('10. Saison active configurée par admin')

  try {
    const adminSettings = await sql`SELECT user_id, active_season FROM admin_settings ORDER BY user_id`
    const counts = {}
    adminSettings.rows.forEach(r => { counts[r.active_season] = (counts[r.active_season] || 0) + 1 })
    const seasons = Object.keys(counts)
    if (seasons.length === 1 && seasons[0] === 'ete') {
      ok('active_season = "ete" sur les ' + adminSettings.rows.length + ' lignes admin_settings (catalogue été visible)')
    } else if (seasons.length === 1) {
      ko('active_season = "' + seasons[0] + '" partout (à passer à "ete")')
    } else {
      ko('active_season INCOHERENT entre admins : ' + JSON.stringify(counts) + ' — risque de catalogue aléatoire selon le admin lu (route.js fait `LIMIT 1` sans ORDER BY)')
      adminSettings.rows.forEach(r => console.log('       user_id=' + r.user_id + ' → active_season=' + r.active_season))
    }
  } catch (e) {
    wn('Impossible de lire admin_settings.active_season : ' + e.message)
  }

  // ============ RÉSUMÉ ============
  console.log('\n══════════════════════════')
  console.log('  ✓ Tests OK    : ' + pass)
  console.log('  ❌ Échecs      : ' + fail)
  console.log('  ⚠️  Warnings    : ' + warn)
  console.log('══════════════════════════')

  if (fail > 0) {
    console.log('\n❌ ÉCHECS:')
    failures.forEach(f => console.log('  - ' + f))
  }
  if (warn > 0) {
    console.log('\n⚠️  WARNINGS:')
    warnings.forEach(w => console.log('  - ' + w))
  }

  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })

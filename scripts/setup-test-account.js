#!/usr/bin/env node
/**
 * Compte de test qui voit le catalogue COMME Mme Cherchemont.
 *
 * Sert à vérifier ses adaptations (plats masqués, renommés, ingrédients
 * remplacés ou ajoutés) sans se connecter à son compte et sans risquer de
 * toucher ses vraies sélections.
 *
 * Deux garde-fous volontaires :
 *   - le compte n'entre PAS dans son foyer (`household_id` laissé vide), sinon
 *     une sélection de test écraserait la sienne ;
 *   - il ne reçoit pas de rappels automatiques.
 *
 *   node scripts/setup-test-account.js                    # crée/renouvelle le compte
 *   node scripts/setup-test-account.js --clone-overrides  # + copie ses règles ACTUELLES
 *
 * Sans --clone-overrides, appliquer le jeu de règles de référence :
 *   node scripts/setup-cherchemont-overrides.js --user=<id affiché>
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')
const bcrypt = require('bcryptjs')

const SOURCE_USER_ID = 14                 // Mme Cherchemont
const TEST_EMAIL = 'test@foxfood.com'
const TEST_PASSWORD = 'test1234'
const CLONE = process.argv.includes('--clone-overrides')

async function run() {
  const source = await sql`
    SELECT name, delivery_day, delivery_time_slot, household_size,
           dietary_preferences, avoided_ingredients
    FROM users WHERE id = ${SOURCE_USER_ID}
  `
  if (source.rows.length === 0) {
    throw new Error(`Utilisateur source ${SOURCE_USER_ID} introuvable`)
  }
  const src = source.rows[0]
  console.log(`👤 Modèle : ${src.name} (id ${SOURCE_USER_ID}) — ${src.household_size} pers., livraison ${src.delivery_day} ${src.delivery_time_slot}\n`)

  const password = await bcrypt.hash(TEST_PASSWORD, 10)

  const upsert = await sql`
    INSERT INTO users (
      email, name, password, role, approval_status, active,
      delivery_day, delivery_time_slot, household_size,
      dietary_preferences, avoided_ingredients,
      onboarding_completed, settings_completed, receive_notifications, household_id
    )
    VALUES (
      ${TEST_EMAIL}, ${'Test — vue ' + src.name}, ${password}, 'client', 'approved', true,
      ${src.delivery_day}, ${src.delivery_time_slot}, ${src.household_size},
      ${JSON.stringify(src.dietary_preferences || [])}::jsonb,
      ${JSON.stringify(src.avoided_ingredients || [])}::jsonb,
      true, true, false, NULL
    )
    ON CONFLICT (email) DO UPDATE SET
      password = EXCLUDED.password,
      name = EXCLUDED.name,
      role = 'client',
      approval_status = 'approved',
      active = true,
      delivery_day = EXCLUDED.delivery_day,
      delivery_time_slot = EXCLUDED.delivery_time_slot,
      household_size = EXCLUDED.household_size,
      dietary_preferences = EXCLUDED.dietary_preferences,
      avoided_ingredients = EXCLUDED.avoided_ingredients,
      onboarding_completed = true,
      settings_completed = true,
      receive_notifications = false,
      household_id = NULL,
      updated_at = NOW()
    RETURNING id
  `
  const testId = upsert.rows[0].id
  console.log(`✅ Compte ${TEST_EMAIL} prêt (id ${testId}, mot de passe « ${TEST_PASSWORD} »)`)

  // Remplacements globaux d'ingrédients (indépendants des overrides par plat)
  await sql`DELETE FROM user_ingredient_replacements WHERE user_id = ${testId}`
  const repl = await sql`
    INSERT INTO user_ingredient_replacements (user_id, original_ingredient_id, replacement_ingredient_id)
    SELECT ${testId}, original_ingredient_id, replacement_ingredient_id
    FROM user_ingredient_replacements WHERE user_id = ${SOURCE_USER_ID}
    RETURNING id
  `
  console.log(`🔄 ${repl.rows.length} remplacement(s) global(aux) copié(s)`)

  if (CLONE) {
    await sql`DELETE FROM user_dish_overrides WHERE user_id = ${testId}`
    const copied = await sql`
      INSERT INTO user_dish_overrides (user_id, dish_id, action, custom_name, remove_ingredients, substitute_ingredients, add_ingredients)
      SELECT ${testId}, dish_id, action, custom_name, remove_ingredients, substitute_ingredients, add_ingredients
      FROM user_dish_overrides WHERE user_id = ${SOURCE_USER_ID}
      RETURNING id
    `
    console.log(`📋 ${copied.rows.length} override(s) copié(s) depuis le compte de Mme Cherchemont`)
  } else {
    const existing = await sql`SELECT COUNT(*) c FROM user_dish_overrides WHERE user_id = ${testId}`
    console.log(`📋 ${existing.rows[0].c} override(s) déjà en place sur ce compte`)
    console.log(`   → pour appliquer le jeu de règles de référence :`)
    console.log(`     node scripts/setup-cherchemont-overrides.js --user=${testId}`)
  }

  console.log(`\n⚠️  Ce compte n'est PAS dans le foyer de Mme Cherchemont : ses sélections de test`)
  console.log(`   ne touchent pas les vraies. En revanche, enregistrer une sélection déclenche`)
  console.log(`   bien la notification à l'admin — c'est voulu pour tester les emails.`)
}

run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1) })

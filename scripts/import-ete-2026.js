#!/usr/bin/env node
/**
 * Importe en production les plats de l'été 2026 (lit scripts/ete-2026-plats.json).
 *
 * Actions:
 *  1) Pour chaque plat recyclé : ajoute 'ete' à dishes.seasons si manquant
 *     (retire 'toutes' au passage car 'toutes' = visible partout, donc ete inutile)
 *  2) Pour chaque nouveau plat  : INSERT dans dishes avec seasons=['ete'], active=true
 *
 * Idempotent : peut être relancé sans risque.
 * Options:
 *  --dry-run : montre seulement ce qui serait fait
 *  --confirm : exécute (sinon mode dry-run par défaut)
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { sql } = require('@vercel/postgres')

const JSON_IN = path.join(__dirname, 'ete-2026-plats.json')

const isDryRun = !process.argv.includes('--confirm')

async function main() {
  if (!fs.existsSync(JSON_IN)) {
    console.error(`❌ Fichier introuvable: ${JSON_IN}`)
    console.error('   Lance d\'abord: node scripts/parse-ete-2026.js')
    process.exit(1)
  }
  const data = JSON.parse(fs.readFileSync(JSON_IN, 'utf8'))

  console.log('🌞 Import Été 2026')
  console.log(`   Mode: ${isDryRun ? 'DRY-RUN (aucune écriture)' : 'CONFIRM (écriture)'}`)
  console.log(`   ${data.recycled.length} plats recyclés, ${data.newDishes.length} nouveaux plats à créer`)
  console.log()

  // ============ 1. EXTENSION SAISON 'ete' POUR PLATS RECYCLÉS ============
  console.log('━━━ 1. Extension saison \'ete\' ━━━')
  let extended = 0, alreadyEte = 0, noMatch = 0
  for (const r of data.recycled) {
    if (!r.matched) {
      console.log(`  ❌ ${r.rawName} — pas de match catalogue`)
      noMatch++
      continue
    }
    if (!r.matched.needsEte) {
      console.log(`  ✓  [${r.matched.id}] ${r.matched.name} — déjà 'ete'/'toutes'`)
      alreadyEte++
      continue
    }
    if (!isDryRun) {
      await sql`
        UPDATE dishes
        SET seasons = CASE
          WHEN seasons @> '"ete"'::jsonb THEN seasons
          ELSE (seasons - 'toutes') || '["ete"]'::jsonb
        END,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ${r.matched.id}
      `
    }
    console.log(`  ➕ [${r.matched.id}] ${r.matched.name} (${r.matched.currentSeasons.join(',')} → +ete)`)
    extended++
  }
  console.log(`  → ${extended} étendus, ${alreadyEte} déjà ete, ${noMatch} sans match`)
  console.log()

  // ============ 2. CRÉATION DES NOUVEAUX PLATS ============
  console.log('━━━ 2. Création des nouveaux plats ━━━')
  let inserted = 0, skipped = 0, failed = 0
  for (const d of data.newDishes) {
    try {
      // Idempotence: skip si nom existe déjà
      const existing = await sql`SELECT id, seasons FROM dishes WHERE name = ${d.cleanedName} LIMIT 1`
      if (existing.rows.length > 0) {
        const row = existing.rows[0]
        const seasons = Array.isArray(row.seasons) ? row.seasons : JSON.parse(row.seasons || '[]')
        if (seasons.includes('ete') || seasons.includes('toutes')) {
          console.log(`  ⊘ [${row.id}] ${d.cleanedName} — existe déjà (saisons OK)`)
          skipped++
        } else {
          // Existe mais sans saison été : étend
          if (!isDryRun) {
            await sql`
              UPDATE dishes
              SET seasons = seasons || '["ete"]'::jsonb,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${row.id}
            `
          }
          console.log(`  ➕ [${row.id}] ${d.cleanedName} — existait, +ete`)
          skipped++
        }
        continue
      }
      // Description vide (à compléter par le chef)
      const desc = ''
      const ingredientsJson = JSON.stringify(d.ingredients)
      const seasonsJson = JSON.stringify(d.seasons)
      if (!isDryRun) {
        await sql`
          INSERT INTO dishes (name, category, description, ingredients, seasons, active, kids_food)
          VALUES (
            ${d.cleanedName},
            ${d.category},
            ${desc},
            ${ingredientsJson}::jsonb,
            ${seasonsJson}::jsonb,
            ${d.active},
            ${d.kids_food}
          )
        `
      }
      const ingCount = d.ingredients.length
      console.log(`  🆕 ${d.category.padEnd(10)} | ${d.cleanedName} (${ingCount} ingr.)`)
      inserted++
    } catch (err) {
      console.log(`  ❌ ${d.cleanedName}: ${err.message.substring(0, 80)}`)
      failed++
    }
  }
  console.log(`  → ${inserted} créés, ${skipped} déjà existants, ${failed} échecs`)
  console.log()

  // ============ RÉCAP ============
  console.log('━━━ RÉSUMÉ ━━━')
  console.log(`  Plats étendus saison ete : ${extended}`)
  console.log(`  Plats créés              : ${inserted}`)
  console.log(`  Plats déjà existants     : ${skipped + alreadyEte}`)
  console.log(`  Échecs                   : ${failed + noMatch}`)
  if (isDryRun) {
    console.log()
    console.log('  💡 Pour exécuter réellement : node scripts/import-ete-2026.js --confirm')
  } else {
    console.log()
    console.log('  ✅ Import terminé.')
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })

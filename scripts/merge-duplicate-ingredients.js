#!/usr/bin/env node
/**
 * Fusionne les ingrédients dupliqués (créés par l'import été 2026) et
 * normalise les unités de dish_ingredients.
 *
 * Causes traitées :
 *  - Même ingrédient existant sous 2 IDs (singulier/pluriel, accents) => fusion vers l'ID canonique.
 *  - Unités en majuscules (GR, PCE, CL...) qui empêchent l'agrégation par id+unité.
 *
 * Sécurité :
 *  - Dry-run par défaut (affiche le plan, ne modifie rien).
 *  - `node scripts/merge-duplicate-ingredients.js --apply` pour exécuter dans une transaction.
 *  - Les overrides Cherchemont (user 14) ne référencent que des IDs CONSERVÉS (95, 103) => intacts.
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const APPLY = process.argv.includes('--apply')

// keep = ID canonique conservé ; drop = ID supprimé ; name = nom propre appliqué au survivant
const MERGES = [
  { keep: 103, drop: 24,  name: 'Pommes de terre' },
  { keep: 27,  drop: 297, name: 'Tomates' },
  { keep: 32,  drop: 395, name: 'Poivrons' },
  { keep: 86,  drop: 123, name: 'Champignons de Paris' },
  { keep: 95,  drop: 290, name: 'Maïzena' },
  { keep: 135, drop: 312, name: 'Cornichons' },
  { keep: 198, drop: 394, name: 'Épices mexicaines' },
  { keep: 214, drop: 330, name: 'Lentilles vertes' },
]

// Normalisation des unités (variantes de casse/orthographe de la MÊME unité)
const UNIT_MAP = {
  GR: 'g', gr: 'g',
  CL: 'cl', ML: 'ml',
  PCE: 'pce', Pce: 'pce',
  PCS: 'pce', pcs: 'pce',
  TRANCHE: 'tranche',
}

async function run() {
  console.log(`\n=== Fusion des ingrédients dupliqués + normalisation des unités ===`)
  console.log(APPLY ? '🟢 MODE APPLY (modifications réelles, transaction)\n' : '🟡 MODE DRY-RUN (aucune modification)\n')

  if (APPLY) await sql`BEGIN`
  try {
    // 1) Normaliser les unités dans dish_ingredients
    console.log('— Normalisation des unités (dish_ingredients) —')
    for (const [from, to] of Object.entries(UNIT_MAP)) {
      const cnt = await sql`SELECT COUNT(*) n FROM dish_ingredients WHERE unit = ${from}`
      const n = parseInt(cnt.rows[0].n)
      if (n === 0) continue
      console.log(`   "${from}" -> "${to}" : ${n} ligne(s)`)
      if (APPLY) await sql`UPDATE dish_ingredients SET unit = ${to} WHERE unit = ${from}`
    }

    // 2) Résoudre les conflits (plat/variante référençant keep ET drop) en supprimant la ligne "drop"
    console.log('\n— Résolution des conflits (déduplication intra-plat) —')
    for (const { keep, drop } of MERGES) {
      const dconf = await sql`
        SELECT a.dish_id FROM dish_ingredients a
        JOIN dish_ingredients b ON a.dish_id = b.dish_id
        WHERE a.ingredient_id = ${keep} AND b.ingredient_id = ${drop}
      `
      for (const row of dconf.rows) {
        console.log(`   plat ${row.dish_id}: supprime ligne ingrédient ${drop} (doublon de ${keep})`)
        if (APPLY) await sql`DELETE FROM dish_ingredients WHERE dish_id = ${row.dish_id} AND ingredient_id = ${drop}`
      }
      const vconf = await sql`
        SELECT a.variant_id FROM variant_ingredients a
        JOIN variant_ingredients b ON a.variant_id = b.variant_id
        WHERE a.ingredient_id = ${keep} AND b.ingredient_id = ${drop}
      `
      for (const row of vconf.rows) {
        console.log(`   variante ${row.variant_id}: supprime ligne ingrédient ${drop} (doublon de ${keep})`)
        if (APPLY) await sql`DELETE FROM variant_ingredients WHERE variant_id = ${row.variant_id} AND ingredient_id = ${drop}`
      }
    }

    // 3) Repointer les références restantes drop -> keep, puis supprimer l'ingrédient drop
    console.log('\n— Repointage + suppression des doublons —')
    for (const { keep, drop, name } of MERGES) {
      const di = await sql`SELECT COUNT(*) n FROM dish_ingredients WHERE ingredient_id = ${drop}`
      const vi = await sql`SELECT COUNT(*) n FROM variant_ingredients WHERE ingredient_id = ${drop}`
      console.log(`   ${drop} -> ${keep} (${name}) : dish_ingredients=${di.rows[0].n}, variant_ingredients=${vi.rows[0].n}`)
      if (APPLY) {
        await sql`UPDATE dish_ingredients SET ingredient_id = ${keep} WHERE ingredient_id = ${drop}`
        await sql`UPDATE variant_ingredients SET ingredient_id = ${keep} WHERE ingredient_id = ${drop}`
        // Supprimer le doublon AVANT de renommer le survivant (sinon collision sur UNIQUE(name))
        await sql`DELETE FROM ingredients WHERE id = ${drop}`
        await sql`UPDATE ingredients SET name = ${name} WHERE id = ${keep}`
      }
    }

    if (APPLY) {
      await sql`COMMIT`
      console.log('\n✅ Migration appliquée (COMMIT).')
    } else {
      console.log('\nℹ️  Dry-run terminé. Relance avec --apply pour exécuter.')
    }
  } catch (e) {
    if (APPLY) await sql`ROLLBACK`
    console.error('\n❌ Erreur, ROLLBACK:', e.message)
    process.exit(1)
  }
  process.exit(0)
}
run().catch(e => { console.error(e.message); process.exit(1) })

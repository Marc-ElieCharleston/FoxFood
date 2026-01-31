/**
 * Script pour créer la table admin_popup_settings et insérer le message par défaut
 */

import 'dotenv/config'
import { sql } from '@vercel/postgres'

async function createPopupTable() {
  console.log('🔧 Création de la table admin_popup_settings...\n')

  try {
    // Créer la table
    await sql`
      CREATE TABLE IF NOT EXISTS admin_popup_settings (
        id SERIAL PRIMARY KEY,
        is_active BOOLEAN DEFAULT true,
        message TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    console.log('✅ Table admin_popup_settings créée')

    // Insérer le message par défaut
    const result = await sql`
      INSERT INTO admin_popup_settings (is_active, message) VALUES (
        true,
        '👉 Parrainage Foxfood :
Pour chaque personne que tu parraines et qui prend une formule Foxfood (mensuelle ou hebdomadaire),
tu bénéficies de –10 % sur ton offre mensuelle ou hebdomadaire,
à valoir sur le mois suivant.

Il suffit que la personne me contacte de ta part en précisant qu''elle souhaite une formule mensuelle ou hebdomadaire.

Merci encore pour ta confiance,
à très vite en cuisine 👨‍🍳

Emeric – Foxfood'
      )
      RETURNING id, is_active
    `

    console.log('✅ Message de parrainage inséré (ID:', result.rows[0].id, ')')
    console.log('📊 Statut actif:', result.rows[0].is_active ? 'OUI ✓' : 'NON')

    // Vérifier le contenu
    const check = await sql`
      SELECT id, is_active, LEFT(message, 50) as message_preview, updated_at
      FROM admin_popup_settings
    `

    console.log('\n📋 Contenu de la table:')
    console.log(check.rows[0])

    console.log('\n' + '='.repeat(70))
    console.log('✅ Migration réussie ! Le popup de parrainage est maintenant actif.')
    console.log('='.repeat(70))

  } catch (error) {
    console.error('\n❌ Erreur:', error)
    process.exit(1)
  }

  process.exit(0)
}

createPopupTable()

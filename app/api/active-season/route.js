import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer la saison active configurée par l'admin
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // ORDER BY updated_at DESC : la dernière saison modifiée par n'importe quel admin gagne.
    // Sans cet ORDER BY, Postgres pouvait renvoyer une ligne arbitraire et donc un catalogue
    // différent selon les requêtes — bug détecté lors du switch printemps → été 2026.
    const result = await sql`
      SELECT active_season FROM admin_settings
      WHERE active_season IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
    `

    const activeSeason = result.rows.length > 0 && result.rows[0].active_season
      ? result.rows[0].active_season
      : 'printemps'

    return NextResponse.json({ active_season: activeSeason })
  } catch (error) {
    console.error('Erreur lors de la récupération de la saison active:', error)
    // Fallback sur printemps en cas d'erreur (colonne pas encore créée)
    return NextResponse.json({ active_season: 'printemps' })
  }
}

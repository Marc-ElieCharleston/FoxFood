import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

/**
 * DELETE /api/selections/reset
 * Réinitialiser toutes les sélections futures de l'utilisateur
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id

    // Récupérer le household_id si l'utilisateur est dans un foyer
    const userResult = await sql`
      SELECT household_id FROM users WHERE id = ${userId}
    `
    const householdId = userResult.rows[0]?.household_id

    // Supprimer toutes les sélections futures (>= aujourd'hui)
    let result
    if (householdId) {
      // Supprimer par household_id
      result = await sql`
        DELETE FROM weekly_selections
        WHERE household_id = ${householdId}
        AND week_start_date >= CURRENT_DATE
        RETURNING id
      `
    } else {
      // Supprimer par user_id
      result = await sql`
        DELETE FROM weekly_selections
        WHERE user_id = ${userId}
        AND week_start_date >= CURRENT_DATE
        RETURNING id
      `
    }

    const deletedCount = result.rows.length

    console.log(`🗑️ ${deletedCount} sélection(s) supprimée(s) pour l'utilisateur ${session.user.name}`)

    return NextResponse.json({
      success: true,
      message: `${deletedCount} sélection(s) supprimée(s)`,
      deletedCount
    })

  } catch (error) {
    console.error('Erreur lors de la réinitialisation des sélections:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la réinitialisation' },
      { status: 500 }
    )
  }
}

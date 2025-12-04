import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// Générer un code d'invitation unique
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// POST - Régénérer le code d'invitation
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)

    // Récupérer le foyer de l'utilisateur
    const userResult = await sql`
      SELECT household_id FROM users WHERE id = ${userId}
    `

    if (!userResult.rows[0]?.household_id) {
      return NextResponse.json(
        { error: 'Vous n\'appartenez à aucun foyer' },
        { status: 400 }
      )
    }

    const householdId = userResult.rows[0].household_id

    // Vérifier que l'utilisateur est le créateur du foyer
    const householdResult = await sql`
      SELECT created_by FROM households WHERE id = ${householdId}
    `

    if (householdResult.rows[0]?.created_by !== userId) {
      return NextResponse.json(
        { error: 'Seul le créateur du foyer peut régénérer le code d\'invitation' },
        { status: 403 }
      )
    }

    // Générer un nouveau code unique
    let newCode = generateInviteCode()
    let attempts = 0
    while (attempts < 10) {
      const existing = await sql`
        SELECT id FROM households WHERE invite_code = ${newCode} AND id != ${householdId}
      `
      if (existing.rows.length === 0) break
      newCode = generateInviteCode()
      attempts++
    }

    // Mettre à jour le code
    await sql`
      UPDATE households
      SET invite_code = ${newCode}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${householdId}
    `

    return NextResponse.json({
      success: true,
      inviteCode: newCode,
      message: 'Nouveau code d\'invitation généré'
    })
  } catch (error) {
    console.error('Erreur régénération code:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET - Récupérer le lien d'invitation
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)

    // Récupérer le foyer de l'utilisateur
    const userResult = await sql`
      SELECT household_id FROM users WHERE id = ${userId}
    `

    if (!userResult.rows[0]?.household_id) {
      return NextResponse.json(
        { error: 'Vous n\'appartenez à aucun foyer' },
        { status: 400 }
      )
    }

    const householdId = userResult.rows[0].household_id

    // Récupérer le code d'invitation
    const householdResult = await sql`
      SELECT invite_code, name FROM households WHERE id = ${householdId}
    `

    if (householdResult.rows.length === 0) {
      return NextResponse.json({ error: 'Foyer non trouvé' }, { status: 404 })
    }

    const { invite_code, name } = householdResult.rows[0]
    const baseUrl = process.env.NEXTAUTH_URL || 'https://foxfood.vercel.app'
    const inviteLink = `${baseUrl}/rejoindre?code=${invite_code}`

    return NextResponse.json({
      inviteCode: invite_code,
      inviteLink,
      householdName: name
    })
  } catch (error) {
    console.error('Erreur récupération lien:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

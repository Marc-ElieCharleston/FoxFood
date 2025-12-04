import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// POST - Rejoindre un foyer avec un code d'invitation
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)
    const { inviteCode } = await request.json()

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Code d\'invitation requis' },
        { status: 400 }
      )
    }

    // Vérifier si l'utilisateur a déjà un foyer
    const userResult = await sql`
      SELECT household_id FROM users WHERE id = ${userId}
    `

    if (userResult.rows[0]?.household_id) {
      return NextResponse.json(
        { error: 'Vous appartenez déjà à un foyer. Quittez-le d\'abord pour en rejoindre un autre.' },
        { status: 400 }
      )
    }

    // Chercher le foyer avec ce code (case insensitive)
    const householdResult = await sql`
      SELECT * FROM households
      WHERE UPPER(invite_code) = UPPER(${inviteCode.trim()})
    `

    if (householdResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Code d\'invitation invalide' },
        { status: 404 }
      )
    }

    const household = householdResult.rows[0]

    // Vérifier si le code n'a pas expiré (si une date d'expiration est définie)
    if (household.invite_code_expires_at && new Date(household.invite_code_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Ce code d\'invitation a expiré' },
        { status: 400 }
      )
    }

    // Associer l'utilisateur au foyer
    await sql`
      UPDATE users SET household_id = ${household.id} WHERE id = ${userId}
    `

    // Récupérer les infos du créateur
    const creatorResult = await sql`
      SELECT name FROM users WHERE id = ${household.created_by}
    `
    const creatorName = creatorResult.rows[0]?.name || 'Quelqu\'un'

    // Récupérer tous les membres du foyer
    const membersResult = await sql`
      SELECT id, name, email FROM users WHERE household_id = ${household.id}
    `

    return NextResponse.json({
      success: true,
      message: `Vous avez rejoint le foyer de ${creatorName}`,
      household: {
        id: household.id,
        name: household.name
      },
      members: membersResult.rows
    })
  } catch (error) {
    console.error('Erreur rejoindre foyer:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET - Vérifier un code d'invitation (sans rejoindre)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const inviteCode = searchParams.get('code')

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Code d\'invitation requis' },
        { status: 400 }
      )
    }

    // Chercher le foyer avec ce code
    const householdResult = await sql`
      SELECT h.id, h.name, u.name as creator_name
      FROM households h
      LEFT JOIN users u ON h.created_by = u.id
      WHERE UPPER(h.invite_code) = UPPER(${inviteCode.trim()})
    `

    if (householdResult.rows.length === 0) {
      return NextResponse.json(
        { valid: false, error: 'Code invalide' },
        { status: 404 }
      )
    }

    const household = householdResult.rows[0]

    // Compter les membres
    const memberCount = await sql`
      SELECT COUNT(*) as count FROM users WHERE household_id = ${household.id}
    `

    return NextResponse.json({
      valid: true,
      household: {
        name: household.name,
        creatorName: household.creator_name,
        memberCount: parseInt(memberCount.rows[0].count)
      }
    })
  } catch (error) {
    console.error('Erreur vérification code:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

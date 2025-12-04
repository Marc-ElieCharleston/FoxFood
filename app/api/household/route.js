import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// Générer un code d'invitation unique
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Pas de I, O, 0, 1 pour éviter confusion
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// GET - Récupérer le foyer de l'utilisateur actuel
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
      return NextResponse.json({ error: 'Aucun foyer' }, { status: 404 })
    }

    const householdId = userResult.rows[0].household_id

    // Récupérer les détails du foyer
    const householdResult = await sql`
      SELECT h.*, u.name as creator_name
      FROM households h
      LEFT JOIN users u ON h.created_by = u.id
      WHERE h.id = ${householdId}
    `

    if (householdResult.rows.length === 0) {
      return NextResponse.json({ error: 'Foyer non trouvé' }, { status: 404 })
    }

    // Récupérer les membres du foyer
    const membersResult = await sql`
      SELECT id, name, email, created_at
      FROM users
      WHERE household_id = ${householdId}
      ORDER BY created_at ASC
    `

    const household = householdResult.rows[0]
    return NextResponse.json({
      id: household.id,
      name: household.name,
      inviteCode: household.invite_code,
      createdBy: household.created_by,
      creatorName: household.creator_name,
      members: membersResult.rows,
      isCreator: household.created_by === userId
    })
  } catch (error) {
    console.error('Erreur récupération foyer:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer un nouveau foyer
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)
    const { name } = await request.json()

    // Vérifier si l'utilisateur a déjà un foyer
    const userResult = await sql`
      SELECT household_id FROM users WHERE id = ${userId}
    `

    if (userResult.rows[0]?.household_id) {
      return NextResponse.json(
        { error: 'Vous appartenez déjà à un foyer' },
        { status: 400 }
      )
    }

    // Générer un code d'invitation unique
    let inviteCode = generateInviteCode()
    let attempts = 0
    while (attempts < 10) {
      const existing = await sql`
        SELECT id FROM households WHERE invite_code = ${inviteCode}
      `
      if (existing.rows.length === 0) break
      inviteCode = generateInviteCode()
      attempts++
    }

    // Créer le foyer
    const householdResult = await sql`
      INSERT INTO households (name, created_by, invite_code)
      VALUES (${name || 'Mon foyer'}, ${userId}, ${inviteCode})
      RETURNING *
    `

    const household = householdResult.rows[0]

    // Associer l'utilisateur au foyer
    await sql`
      UPDATE users SET household_id = ${household.id} WHERE id = ${userId}
    `

    return NextResponse.json({
      success: true,
      household,
      inviteCode: household.invite_code
    })
  } catch (error) {
    console.error('Erreur création foyer:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Quitter le foyer
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)

    // Récupérer le foyer actuel
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

    // Retirer l'utilisateur du foyer
    await sql`
      UPDATE users SET household_id = NULL WHERE id = ${userId}
    `

    // Vérifier s'il reste des membres dans le foyer
    const remainingMembers = await sql`
      SELECT COUNT(*) as count FROM users WHERE household_id = ${householdId}
    `

    // Si plus aucun membre, supprimer le foyer
    if (parseInt(remainingMembers.rows[0].count) === 0) {
      await sql`
        DELETE FROM households WHERE id = ${householdId}
      `
    }

    return NextResponse.json({ success: true, message: 'Vous avez quitté le foyer' })
  } catch (error) {
    console.error('Erreur quitter foyer:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

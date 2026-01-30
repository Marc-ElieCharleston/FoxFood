import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer les paramètres du popup
export async function GET() {
  try {
    const result = await sql`
      SELECT is_active, message, updated_at
      FROM admin_popup_settings
      ORDER BY id DESC
      LIMIT 1
    `

    if (result.rows.length === 0) {
      return NextResponse.json({
        is_active: false,
        message: '',
        updated_at: null
      })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Erreur récupération popup settings:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST - Mettre à jour les paramètres (admin only)
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }

    const { is_active, message } = await request.json()

    // Validation
    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'is_active doit être un booléen' },
        { status: 400 }
      )
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le message ne peut pas être vide' },
        { status: 400 }
      )
    }

    // Supprimer l'ancien paramétrage et insérer le nouveau
    await sql`DELETE FROM admin_popup_settings`

    await sql`
      INSERT INTO admin_popup_settings (is_active, message, updated_at)
      VALUES (${is_active}, ${message}, CURRENT_TIMESTAMP)
    `

    return NextResponse.json({
      success: true,
      message: 'Paramètres mis à jour avec succès'
    })
  } catch (error) {
    console.error('Erreur mise à jour popup settings:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

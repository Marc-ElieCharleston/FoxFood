import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// PUT - Mettre à jour une demande (admin only)
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    const { id } = params
    const { status, admin_notes } = await request.json()

    // Validation
    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide' },
        { status: 400 }
      )
    }

    // Mettre à jour la demande
    const result = await sql`
      UPDATE custom_dish_requests
      SET
        status = ${status},
        admin_notes = ${admin_notes || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Demande non trouvée' },
        { status: 404 }
      )
    }

    // TODO: Envoyer notification à l'utilisateur
    // Ce sera implémenté dans la phase 5

    return NextResponse.json({
      message: 'Demande mise à jour avec succès',
      request: result.rows[0]
    })
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la demande:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la demande' },
      { status: 500 }
    )
  }
}

// DELETE - Supprimer une demande (admin only)
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    const { id } = params

    const result = await sql`
      DELETE FROM custom_dish_requests
      WHERE id = ${parseInt(id)}
      RETURNING id
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Demande non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Demande supprimée avec succès'
    })
  } catch (error) {
    console.error('Erreur lors de la suppression de la demande:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la demande' },
      { status: 500 }
    )
  }
}

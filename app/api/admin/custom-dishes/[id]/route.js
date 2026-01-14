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

    const updatedRequest = result.rows[0]

    // Si le statut passe à "approved", créer automatiquement le plat dans le catalogue
    if (status === 'approved') {
      try {
        // Créer le plat dans la table dishes
        const dishResult = await sql`
          INSERT INTO dishes (name, category, description, active, seasons)
          VALUES (
            ${updatedRequest.dish_name},
            'vegetation',
            ${updatedRequest.description + ' (Plat personnalisé)'},
            true,
            '["toutes"]'::jsonb
          )
          RETURNING id
        `

        const newDishId = dishResult.rows[0].id

        // Créer une variante par défaut "Classique" pour ce plat
        await sql`
          INSERT INTO dish_variants (dish_id, name, dietary_tags, is_default, active)
          VALUES (
            ${newDishId},
            'Classique',
            '[]'::jsonb,
            true,
            true
          )
        `

        console.log(`Plat personnalisé créé avec ID ${newDishId} pour la demande ${id}`)
      } catch (dishError) {
        console.error('Erreur création plat dans catalogue:', dishError)
        // Ne pas bloquer l'approbation si la création du plat échoue
        // L'admin pourra créer le plat manuellement
      }
    }

    // Envoyer notification à l'utilisateur si statut changé (approved/rejected)
    if (status === 'approved' || status === 'rejected') {
      try {
        // Récupérer les infos de l'utilisateur
        const userResult = await sql`
          SELECT id, name, email, notification_phone
          FROM users
          WHERE id = ${updatedRequest.user_id}
        `

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0]

          const { notifyUserCustomDishResponse } = await import('@/lib/notifications')

          await notifyUserCustomDishResponse({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            userPhone: user.notification_phone,
            dishName: updatedRequest.dish_name,
            status: status,
            adminNotes: admin_notes
          })
        }
      } catch (notifError) {
        console.error('Erreur notification utilisateur:', notifError)
        // Ne pas bloquer la mise à jour si la notification échoue
      }
    }

    return NextResponse.json({
      message: 'Demande mise à jour avec succès',
      request: updatedRequest
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

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer toutes les demandes (admin only)
export async function GET(request) {
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

    // Récupérer le paramètre de statut (optionnel)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let requests
    if (status) {
      requests = await sql`
        SELECT
          cdr.id,
          cdr.dish_name,
          cdr.description,
          cdr.suggested_ingredients,
          cdr.is_detailed,
          cdr.status,
          cdr.admin_notes,
          cdr.created_at,
          cdr.updated_at,
          u.name as user_name,
          u.email as user_email
        FROM custom_dish_requests cdr
        JOIN users u ON cdr.user_id = u.id
        WHERE cdr.status = ${status}
        ORDER BY cdr.created_at DESC
      `
    } else {
      requests = await sql`
        SELECT
          cdr.id,
          cdr.dish_name,
          cdr.description,
          cdr.suggested_ingredients,
          cdr.is_detailed,
          cdr.status,
          cdr.admin_notes,
          cdr.created_at,
          cdr.updated_at,
          u.name as user_name,
          u.email as user_email
        FROM custom_dish_requests cdr
        JOIN users u ON cdr.user_id = u.id
        ORDER BY cdr.created_at DESC
      `
    }

    return NextResponse.json(requests.rows)
  } catch (error) {
    console.error('Erreur lors de la récupération des demandes:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des demandes' },
      { status: 500 }
    )
  }
}

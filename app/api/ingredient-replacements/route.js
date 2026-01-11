import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

/**
 * GET /api/ingredient-replacements
 * Récupérer les remplacements d'ingrédients de l'utilisateur
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const result = await sql`
      SELECT
        r.id,
        r.original_ingredient_id,
        oi.name as original_name,
        r.replacement_ingredient_id,
        ri.name as replacement_name
      FROM user_ingredient_replacements r
      JOIN ingredients oi ON r.original_ingredient_id = oi.id
      JOIN ingredients ri ON r.replacement_ingredient_id = ri.id
      WHERE r.user_id = ${session.user.id}
      ORDER BY oi.name
    `

    return NextResponse.json({ replacements: result.rows })
  } catch (error) {
    console.error('Erreur récupération remplacements:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des remplacements' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ingredient-replacements
 * Ajouter un remplacement d'ingrédient
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { originalIngredientId, replacementIngredientId } = await request.json()

    if (!originalIngredientId || !replacementIngredientId) {
      return NextResponse.json(
        { error: 'Ingrédients manquants' },
        { status: 400 }
      )
    }

    if (originalIngredientId === replacementIngredientId) {
      return NextResponse.json(
        { error: 'L\'ingrédient de remplacement doit être différent' },
        { status: 400 }
      )
    }

    // Vérifier que les ingrédients existent
    const ingredientsCheck = await sql`
      SELECT id FROM ingredients
      WHERE id IN (${originalIngredientId}, ${replacementIngredientId})
    `

    if (ingredientsCheck.rows.length !== 2) {
      return NextResponse.json(
        { error: 'Un ou plusieurs ingrédients n\'existent pas' },
        { status: 400 }
      )
    }

    // Insérer ou mettre à jour le remplacement
    const result = await sql`
      INSERT INTO user_ingredient_replacements (user_id, original_ingredient_id, replacement_ingredient_id)
      VALUES (${session.user.id}, ${originalIngredientId}, ${replacementIngredientId})
      ON CONFLICT (user_id, original_ingredient_id)
      DO UPDATE SET replacement_ingredient_id = ${replacementIngredientId}
      RETURNING id
    `

    return NextResponse.json({
      success: true,
      replacementId: result.rows[0].id
    })
  } catch (error) {
    console.error('Erreur ajout remplacement:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout du remplacement' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ingredient-replacements
 * Supprimer un remplacement d'ingrédient
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const replacementId = searchParams.get('id')

    if (!replacementId) {
      return NextResponse.json(
        { error: 'ID du remplacement manquant' },
        { status: 400 }
      )
    }

    // Supprimer uniquement si appartient à l'utilisateur
    const result = await sql`
      DELETE FROM user_ingredient_replacements
      WHERE id = ${replacementId} AND user_id = ${session.user.id}
      RETURNING id
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Remplacement non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur suppression remplacement:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du remplacement' },
      { status: 500 }
    )
  }
}

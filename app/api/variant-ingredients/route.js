import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer les ingrédients d'une variante
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const variantId = searchParams.get('variantId')

    if (!variantId) {
      return NextResponse.json({ error: 'variantId requis' }, { status: 400 })
    }

    const result = await sql`
      SELECT
        vi.id,
        vi.variant_id,
        vi.ingredient_id,
        vi.quantity,
        vi.unit,
        vi.notes,
        i.name as ingredient_name,
        i.default_unit,
        i.dietary_tags as ingredient_tags,
        i.category as ingredient_category
      FROM variant_ingredients vi
      JOIN ingredients i ON vi.ingredient_id = i.id
      WHERE vi.variant_id = ${parseInt(variantId)}
      ORDER BY i.category, i.name
    `

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Ajouter un ingrédient à une variante
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { variantId, ingredientId, quantity, unit, notes } = await request.json()

    if (!variantId || !ingredientId) {
      return NextResponse.json({ error: 'variantId et ingredientId requis' }, { status: 400 })
    }

    // Récupérer l'unité par défaut si non spécifiée
    let finalUnit = unit
    if (!finalUnit) {
      const ingredient = await sql`SELECT default_unit FROM ingredients WHERE id = ${ingredientId}`
      finalUnit = ingredient.rows[0]?.default_unit || 'g'
    }

    const result = await sql`
      INSERT INTO variant_ingredients (variant_id, ingredient_id, quantity, unit, notes)
      VALUES (${variantId}, ${ingredientId}, ${quantity || 1}, ${finalUnit}, ${notes || null})
      ON CONFLICT (variant_id, ingredient_id)
      DO UPDATE SET
        quantity = ${quantity || 1},
        unit = ${finalUnit},
        notes = ${notes || null}
      RETURNING *
    `

    // Récupérer l'ingrédient complet pour la réponse
    const fullResult = await sql`
      SELECT
        vi.id,
        vi.variant_id,
        vi.ingredient_id,
        vi.quantity,
        vi.unit,
        vi.notes,
        i.name as ingredient_name,
        i.default_unit,
        i.dietary_tags as ingredient_tags,
        i.category as ingredient_category
      FROM variant_ingredients vi
      JOIN ingredients i ON vi.ingredient_id = i.id
      WHERE vi.id = ${result.rows[0].id}
    `

    return NextResponse.json(fullResult.rows[0], { status: 201 })
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Mettre à jour la quantité d'un ingrédient dans une variante
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { id, quantity, unit, notes } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    const result = await sql`
      UPDATE variant_ingredients
      SET
        quantity = COALESCE(${quantity}, quantity),
        unit = COALESCE(${unit}, unit),
        notes = COALESCE(${notes}, notes)
      WHERE id = ${id}
      RETURNING *
    `

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Retirer un ingrédient d'une variante
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    await sql`DELETE FROM variant_ingredients WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

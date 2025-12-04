import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer les variantes d'un plat ou toutes les variantes
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const dishId = searchParams.get('dishId')

    if (dishId) {
      // Récupérer les variantes d'un plat spécifique
      const result = await sql`
        SELECT * FROM dish_variants
        WHERE dish_id = ${parseInt(dishId)}
        ORDER BY is_default DESC, name ASC
      `
      return NextResponse.json(result.rows)
    } else {
      // Récupérer toutes les variantes avec infos du plat
      const result = await sql`
        SELECT
          dv.*,
          d.name as dish_name,
          d.category as dish_category
        FROM dish_variants dv
        JOIN dishes d ON dv.dish_id = d.id
        ORDER BY d.name, dv.is_default DESC, dv.name
      `
      return NextResponse.json(result.rows)
    }
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer une nouvelle variante
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { dishId, name, ingredients, tags, isDefault, copyFrom } = await request.json()

    if (!dishId || !name) {
      return NextResponse.json(
        { error: 'dishId et name sont requis' },
        { status: 400 }
      )
    }

    let variantIngredients = ingredients || []
    let variantTags = tags || []

    // Si copyFrom est fourni, copier les ingrédients de cette variante
    if (copyFrom) {
      const sourceVariant = await sql`
        SELECT ingredients, tags FROM dish_variants WHERE id = ${copyFrom}
      `
      if (sourceVariant.rows.length > 0) {
        variantIngredients = sourceVariant.rows[0].ingredients || []
        variantTags = sourceVariant.rows[0].tags || []
      }
    }

    // Si c'est la variante par défaut, enlever le flag des autres
    if (isDefault) {
      await sql`
        UPDATE dish_variants SET is_default = false WHERE dish_id = ${dishId}
      `
    }

    const result = await sql`
      INSERT INTO dish_variants (dish_id, name, ingredients, tags, is_default, active)
      VALUES (
        ${dishId},
        ${name},
        ${JSON.stringify(variantIngredients)},
        ${JSON.stringify(variantTags)},
        ${isDefault || false},
        true
      )
      RETURNING *
    `

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Mettre à jour une variante
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { id, name, ingredients, tags, isDefault, active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    // Si c'est la variante par défaut, enlever le flag des autres
    if (isDefault) {
      const variant = await sql`SELECT dish_id FROM dish_variants WHERE id = ${id}`
      if (variant.rows.length > 0) {
        await sql`
          UPDATE dish_variants SET is_default = false WHERE dish_id = ${variant.rows[0].dish_id}
        `
      }
    }

    const result = await sql`
      UPDATE dish_variants
      SET
        name = COALESCE(${name}, name),
        ingredients = COALESCE(${ingredients ? JSON.stringify(ingredients) : null}, ingredients),
        tags = COALESCE(${tags ? JSON.stringify(tags) : null}, tags),
        is_default = COALESCE(${isDefault}, is_default),
        active = COALESCE(${active}, active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Variante non trouvée' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer une variante
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

    // Vérifier qu'il reste au moins une variante pour le plat
    const variant = await sql`SELECT dish_id FROM dish_variants WHERE id = ${id}`
    if (variant.rows.length > 0) {
      const count = await sql`
        SELECT COUNT(*) as count FROM dish_variants WHERE dish_id = ${variant.rows[0].dish_id}
      `
      if (parseInt(count.rows[0].count) <= 1) {
        return NextResponse.json(
          { error: 'Impossible de supprimer la dernière variante d\'un plat' },
          { status: 400 }
        )
      }
    }

    await sql`DELETE FROM dish_variants WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

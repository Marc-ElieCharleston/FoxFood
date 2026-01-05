import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer tous les ingrédients ou par catégorie
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const activeOnly = searchParams.get('active') === 'true'
    const search = searchParams.get('search')

    let result
    if (category && activeOnly) {
      result = await sql`
        SELECT * FROM ingredients
        WHERE category = ${category} AND active = true
        ORDER BY LOWER(name)
      `
    } else if (category) {
      result = await sql`
        SELECT * FROM ingredients
        WHERE category = ${category}
        ORDER BY LOWER(name)
      `
    } else if (activeOnly) {
      result = await sql`
        SELECT * FROM ingredients
        WHERE active = true
        ORDER BY category, LOWER(name)
      `
    } else if (search) {
      result = await sql`
        SELECT * FROM ingredients
        WHERE name ILIKE ${'%' + search + '%'}
        ORDER BY LOWER(name)
        LIMIT 20
      `
    } else {
      result = await sql`
        SELECT * FROM ingredients
        ORDER BY category, LOWER(name)
      `
    }

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Créer un nouvel ingrédient (admin uniquement)
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { name, default_unit, dietary_tags, category } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO ingredients (name, default_unit, dietary_tags, category)
      VALUES (
        ${name},
        ${default_unit || 'g'},
        ${JSON.stringify(dietary_tags || [])}::jsonb,
        ${category || null}
      )
      RETURNING *
    `

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Erreur:', error)
    if (error.message?.includes('duplicate key')) {
      return NextResponse.json({ error: 'Cet ingrédient existe déjà' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Mettre à jour un ingrédient (admin uniquement)
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { id, name, default_unit, dietary_tags, category, active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const result = await sql`
      UPDATE ingredients
      SET
        name = COALESCE(${name}, name),
        default_unit = COALESCE(${default_unit}, default_unit),
        dietary_tags = COALESCE(${dietary_tags ? JSON.stringify(dietary_tags) : null}::jsonb, dietary_tags),
        category = COALESCE(${category}, category),
        active = COALESCE(${active}, active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Ingrédient non trouvé' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Supprimer un ingrédient (admin uniquement)
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Vérifier si l'ingrédient est utilisé dans des variantes
    const usageCheck = await sql`
      SELECT COUNT(*) as count FROM variant_ingredients WHERE ingredient_id = ${id}
    `
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Cet ingrédient est utilisé dans des recettes. Désactivez-le plutôt.' },
        { status: 400 }
      )
    }

    await sql`DELETE FROM ingredients WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

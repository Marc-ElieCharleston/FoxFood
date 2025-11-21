import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer tous les plats ou par catégorie
export async function GET(request) {
  try {
    // Vérifier l'authentification
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const activeOnly = searchParams.get('active') === 'true'

    let result
    if (category && activeOnly) {
      result = await sql`
        SELECT * FROM dishes
        WHERE category = ${category} AND active = true
        ORDER BY name
      `
    } else if (category) {
      result = await sql`
        SELECT * FROM dishes
        WHERE category = ${category}
        ORDER BY name
      `
    } else if (activeOnly) {
      result = await sql`
        SELECT * FROM dishes
        WHERE active = true
        ORDER BY category, name
      `
    } else {
      result = await sql`
        SELECT * FROM dishes
        ORDER BY category, name
      `
    }

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Erreur lors de la récupération des plats:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des plats' },
      { status: 500 }
    )
  }
}

// POST - Créer un nouveau plat (admin uniquement)
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }

    const { name, category, description, ingredients } = await request.json()

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Nom et catégorie requis' },
        { status: 400 }
      )
    }

    const result = await sql`
      INSERT INTO dishes (name, category, description, ingredients, active)
      VALUES (${name}, ${category}, ${description || ''}, ${JSON.stringify(ingredients || [])}, true)
      RETURNING *
    `

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error) {
    console.error('Erreur lors de la création du plat:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du plat' },
      { status: 500 }
    )
  }
}

// PUT - Mettre à jour un plat (admin uniquement)
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }

    const { id, name, category, description, ingredients, active } = await request.json()

    if (!id || !name || !category) {
      return NextResponse.json(
        { error: 'ID, nom et catégorie requis' },
        { status: 400 }
      )
    }

    const result = await sql`
      UPDATE dishes
      SET name = ${name},
          category = ${category},
          description = ${description || ''},
          ingredients = ${JSON.stringify(ingredients || [])},
          active = ${active !== undefined ? active : true},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Plat non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Erreur lors de la mise à jour du plat:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du plat' },
      { status: 500 }
    )
  }
}

// DELETE - Supprimer un plat (admin uniquement)
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID requis' },
        { status: 400 }
      )
    }

    const result = await sql`
      DELETE FROM dishes WHERE id = ${id}
      RETURNING *
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Plat non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Plat supprimé avec succès' })
  } catch (error) {
    console.error('Erreur lors de la suppression du plat:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du plat' },
      { status: 500 }
    )
  }
}

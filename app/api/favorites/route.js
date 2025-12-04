import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer les favoris de l'utilisateur
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const userId = parseInt(session.user.id)

    const result = await sql`
      SELECT favorite_dishes FROM users WHERE id = ${userId}
    `

    const favorites = result.rows[0]?.favorite_dishes || []

    return NextResponse.json(favorites)
  } catch (error) {
    console.error('Erreur lors de la récupération des favoris:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des favoris' },
      { status: 500 }
    )
  }
}

// POST - Ajouter un plat aux favoris
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const userId = parseInt(session.user.id)
    const { dishId } = await request.json()

    if (!dishId) {
      return NextResponse.json(
        { error: 'ID du plat requis' },
        { status: 400 }
      )
    }

    // Récupérer les favoris actuels
    const currentResult = await sql`
      SELECT favorite_dishes FROM users WHERE id = ${userId}
    `

    let favorites = currentResult.rows[0]?.favorite_dishes || []
    if (typeof favorites === 'string') {
      favorites = JSON.parse(favorites)
    }

    // Ajouter le plat s'il n'est pas déjà dans les favoris
    if (!favorites.includes(dishId)) {
      favorites.push(dishId)

      await sql`
        UPDATE users
        SET favorite_dishes = ${JSON.stringify(favorites)}::jsonb
        WHERE id = ${userId}
      `
    }

    return NextResponse.json({
      message: 'Plat ajouté aux favoris',
      favorites
    })
  } catch (error) {
    console.error('Erreur lors de l\'ajout aux favoris:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout aux favoris' },
      { status: 500 }
    )
  }
}

// DELETE - Retirer un plat des favoris
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const userId = parseInt(session.user.id)
    const { searchParams } = new URL(request.url)
    const dishId = parseInt(searchParams.get('dishId'))

    if (!dishId) {
      return NextResponse.json(
        { error: 'ID du plat requis' },
        { status: 400 }
      )
    }

    // Récupérer les favoris actuels
    const currentResult = await sql`
      SELECT favorite_dishes FROM users WHERE id = ${userId}
    `

    let favorites = currentResult.rows[0]?.favorite_dishes || []
    if (typeof favorites === 'string') {
      favorites = JSON.parse(favorites)
    }

    // Retirer le plat des favoris
    favorites = favorites.filter(id => id !== dishId)

    await sql`
      UPDATE users
      SET favorite_dishes = ${JSON.stringify(favorites)}::jsonb
      WHERE id = ${userId}
    `

    return NextResponse.json({
      message: 'Plat retiré des favoris',
      favorites
    })
  } catch (error) {
    console.error('Erreur lors de la suppression du favori:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du favori' },
      { status: 500 }
    )
  }
}

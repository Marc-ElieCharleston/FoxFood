import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import dishesData from '@/data/dishes.json'

export async function POST(request) {
  try {
    // Vérifier que l'utilisateur est admin
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }

    // Importer tous les plats
    let imported = 0
    for (const dish of dishesData) {
      await sql`
        INSERT INTO dishes (name, category, description, ingredients, active)
        VALUES (${dish.name}, ${dish.category}, ${dish.description}, ${JSON.stringify(dish.ingredients)}, true)
        ON CONFLICT DO NOTHING
      `
      imported++
    }

    return NextResponse.json({
      message: `${imported} plats importés avec succès`,
      count: imported
    })
  } catch (error) {
    console.error('Erreur lors de l\'importation:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'importation des plats' },
      { status: 500 }
    )
  }
}

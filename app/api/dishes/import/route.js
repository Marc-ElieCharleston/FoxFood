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
    let skipped = 0

    for (const dish of dishesData) {
      try {
        // Vérifier si le plat existe déjà
        const existing = await sql`
          SELECT id FROM dishes WHERE name = ${dish.name} LIMIT 1
        `

        if (existing.rows.length === 0) {
          // Le plat n'existe pas, on l'insère
          await sql`
            INSERT INTO dishes (name, category, description, ingredients, active)
            VALUES (${dish.name}, ${dish.category}, ${dish.description}, ${JSON.stringify(dish.ingredients)}, true)
          `
          imported++
        } else {
          skipped++
        }
      } catch (error) {
        console.error(`Erreur pour le plat ${dish.name}:`, error)
      }
    }

    return NextResponse.json({
      message: `${imported} plats importés, ${skipped} déjà existants`,
      imported,
      skipped
    })
  } catch (error) {
    console.error('Erreur lors de l\'importation:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'importation des plats' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'
import { parseExcelDishes, generateDishTemplate } from '@/lib/excel-parser'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    // Vérifier le type de fichier
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: 'Format de fichier invalide. Utilisez .xlsx ou .xls' }, { status: 400 })
    }

    // Lire le fichier
    const buffer = Buffer.from(await file.arrayBuffer())

    // Parser le fichier Excel
    const { dishes, errors } = parseExcelDishes(buffer)

    if (dishes.length === 0 && errors.length > 0) {
      return NextResponse.json({
        error: 'Aucun plat valide trouvé',
        details: errors
      }, { status: 400 })
    }

    // Insérer les plats dans la base de données
    const results = {
      inserted: [],
      skipped: [],
      errors: [...errors]
    }

    for (const dish of dishes) {
      try {
        // Vérifier si le plat existe déjà (par nom)
        const existing = await sql`
          SELECT id FROM dishes WHERE LOWER(name) = LOWER(${dish.name})
        `

        if (existing.rows.length > 0) {
          results.skipped.push(`"${dish.name}" existe déjà`)
          continue
        }

        // Insérer le nouveau plat
        const result = await sql`
          INSERT INTO dishes (name, category, description, seasons, active)
          VALUES (${dish.name}, ${dish.category}, ${dish.description}, ${JSON.stringify(dish.seasons)}, ${dish.active})
          RETURNING id, name
        `

        // Créer automatiquement une variante "Classique" par défaut
        await sql`
          INSERT INTO dish_variants (dish_id, name, tags, is_default, active)
          VALUES (${result.rows[0].id}, 'Classique', '[]', true, true)
        `

        results.inserted.push(dish.name)
      } catch (err) {
        results.errors.push(`Erreur pour "${dish.name}": ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: dishes.length,
        inserted: results.inserted.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      },
      details: results
    })

  } catch (error) {
    console.error('Erreur import Excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'import' }, { status: 500 })
  }
}

// GET pour télécharger le template
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const template = generateDishTemplate()

    return new NextResponse(template, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="foxfood-template-plats.xlsx"'
      }
    })

  } catch (error) {
    console.error('Erreur génération template:', error)
    return NextResponse.json({ error: 'Erreur lors de la génération du template' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
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

    // Cache des ingrédients pour éviter les requêtes répétées
    const ingredientCache = new Map()

    // Fonction pour obtenir ou créer un ingrédient
    const getOrCreateIngredient = async (ingredientName, unit) => {
      const normalizedName = ingredientName.toLowerCase().trim()

      // Vérifier le cache
      if (ingredientCache.has(normalizedName)) {
        return ingredientCache.get(normalizedName)
      }

      // Chercher dans la base
      const existing = await sql`
        SELECT id, name, category, default_unit FROM ingredients
        WHERE LOWER(name) = ${normalizedName}
      `

      if (existing.rows.length > 0) {
        ingredientCache.set(normalizedName, existing.rows[0])
        return existing.rows[0]
      }

      // Créer le nouvel ingrédient
      // Deviner la catégorie basée sur le nom
      let category = 'autre'
      const nameLower = normalizedName
      if (/poulet|boeuf|porc|agneau|veau|canard|dinde|lapin|jambon|lardon|saucisse|viande/.test(nameLower)) {
        category = 'viande'
      } else if (/saumon|thon|cabillaud|crevette|moule|poisson|fruit.?de.?mer|calamar/.test(nameLower)) {
        category = 'poisson'
      } else if (/carotte|oignon|tomate|courgette|aubergine|poivron|haricot|petit.?pois|épinard|salade|légume|champignon|brocoli|chou/.test(nameLower)) {
        category = 'legume'
      } else if (/pomme(?!.?de.?terre)|poire|banane|orange|citron|fraise|fruit|raisin|mangue/.test(nameLower)) {
        category = 'fruit'
      } else if (/riz|pâte|pasta|pomme.?de.?terre|semoule|quinoa|lentille|pois.?chiche|féculent|pain/.test(nameLower)) {
        category = 'feculent'
      } else if (/lait|crème|fromage|beurre|yaourt|parmesan|mozzarella|gruyère/.test(nameLower)) {
        category = 'produit_laitier'
      } else if (/sel|poivre|curry|cumin|paprika|herbe|thym|romarin|basilic|persil|épice|huile|vinaigre|sauce|moutarde|ail|échalote/.test(nameLower)) {
        category = 'epice'
      }

      const newIngredient = await sql`
        INSERT INTO ingredients (name, category, default_unit, active)
        VALUES (${ingredientName.trim()}, ${category}, ${unit || 'g'}, true)
        RETURNING id, name, category, default_unit
      `

      ingredientCache.set(normalizedName, newIngredient.rows[0])
      return newIngredient.rows[0]
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

        const dishId = result.rows[0].id

        // Créer automatiquement une variante "Classique" par défaut
        const variantResult = await sql`
          INSERT INTO dish_variants (dish_id, name, tags, is_default, active)
          VALUES (${dishId}, 'Classique', '[]', true, true)
          RETURNING id
        `

        const variantId = variantResult.rows[0].id

        // Ajouter les ingrédients à la variante
        if (dish.ingredients && dish.ingredients.length > 0) {
          for (const ing of dish.ingredients) {
            try {
              const ingredient = await getOrCreateIngredient(ing.name, ing.unit)

              // Lier l'ingrédient à la variante
              await sql`
                INSERT INTO variant_ingredients (variant_id, ingredient_id, quantity, unit)
                VALUES (${variantId}, ${ingredient.id}, ${ing.quantity}, ${ing.unit})
              `
            } catch (ingErr) {
              console.error(`Erreur ingrédient "${ing.name}":`, ingErr)
              // Continuer malgré l'erreur d'un ingrédient
            }
          }
        }

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

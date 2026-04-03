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
    const season = searchParams.get('season')

    const includeIngredients = searchParams.get('includeIngredients') === 'true' || searchParams.get('includeVariants') === 'true'

    let result
    if (category && activeOnly && season) {
      // Filtrer par categorie, actif et saison
      result = await sql`
        SELECT * FROM dishes
        WHERE category = ${category}
        AND active = true
        AND (seasons @> ${JSON.stringify([season])}::jsonb OR seasons @> '["toutes"]'::jsonb)
        ORDER BY name
      `
    } else if (category && activeOnly) {
      result = await sql`
        SELECT * FROM dishes
        WHERE category = ${category} AND active = true
        ORDER BY name
      `
    } else if (activeOnly && season) {
      // Filtrer par actif et saison
      result = await sql`
        SELECT * FROM dishes
        WHERE active = true
        AND (seasons @> ${JSON.stringify([season])}::jsonb OR seasons @> '["toutes"]'::jsonb)
        ORDER BY category, name
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

    // Charger les overrides de l'utilisateur (masquage, renommage, substitutions par plat)
    const overrides = await sql`
      SELECT * FROM user_dish_overrides WHERE user_id = ${session.user.id}
    `
    const overrideMap = new Map()
    overrides.rows.forEach(o => overrideMap.set(o.dish_id, o))

    // Filtrer les plats masqués (sauf pour admin)
    let dishes = result.rows
    if (session.user.role !== 'admin') {
      dishes = dishes.filter(d => {
        const ov = overrideMap.get(d.id)
        return !ov || ov.action !== 'hide'
      })
    }

    // Si demandé, inclure les ingrédients pour chaque plat
    if (includeIngredients) {
      const dishesWithIngredients = await Promise.all(
        dishes.map(async (dish) => {
          const ingredients = await sql`
            SELECT di.*, i.name as ingredient_name, i.dietary_tags
            FROM dish_ingredients di
            JOIN ingredients i ON i.id = di.ingredient_id
            WHERE di.dish_id = ${dish.id}
          `
          const override = overrideMap.get(dish.id)
          let linkedIngredients = ingredients.rows

          if (override && override.action === 'modify') {
            // Retirer les ingrédients supprimés
            const removeIds = (override.remove_ingredients || []).map(r => r.ingredient_id)
            if (removeIds.length > 0) {
              linkedIngredients = linkedIngredients.filter(ing => !removeIds.includes(ing.ingredient_id))
            }

            // Appliquer les substitutions
            const subs = override.substitute_ingredients || []
            if (subs.length > 0) {
              // Charger les noms des ingrédients de remplacement
              const subMap = new Map(subs.map(s => [s.from_ingredient_id, s.to_ingredient_id]))
              const toIds = subs.map(s => s.to_ingredient_id)
              if (toIds.length > 0) {
                const replacements = await sql`
                  SELECT id, name, dietary_tags FROM ingredients WHERE id = ANY(${toIds})
                `
                const replMap = new Map(replacements.rows.map(r => [r.id, r]))
                linkedIngredients = linkedIngredients.map(ing => {
                  const toId = subMap.get(ing.ingredient_id)
                  if (toId) {
                    const repl = replMap.get(toId)
                    if (repl) {
                      return { ...ing, ingredient_id: repl.id, ingredient_name: repl.name, dietary_tags: repl.dietary_tags }
                    }
                  }
                  return ing
                })
              }
            }
          }

          return {
            ...dish,
            name: (override && override.custom_name) ? override.custom_name : dish.name,
            original_name: (override && override.custom_name) ? dish.name : undefined,
            linked_ingredients: linkedIngredients,
            has_override: !!override
          }
        })
      )
      return NextResponse.json(dishesWithIngredients)
    }

    // Sans ingrédients, appliquer juste le renommage
    const finalDishes = dishes.map(dish => {
      const override = overrideMap.get(dish.id)
      if (override && override.custom_name) {
        return { ...dish, name: override.custom_name, original_name: dish.name, has_override: true }
      }
      return dish
    })

    return NextResponse.json(finalDishes)
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

    const { name, category, description, ingredients, seasons, kids_food, dietary_tags } = await request.json()

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Nom et catégorie requis' },
        { status: 400 }
      )
    }

    // Par defaut, plat disponible toute l'annee
    const dishSeasons = seasons && seasons.length > 0 ? seasons : ['toutes']

    const result = await sql`
      INSERT INTO dishes (name, category, description, ingredients, seasons, active, kids_food, dietary_tags)
      VALUES (${name}, ${category}, ${description || ''}, ${JSON.stringify(ingredients || [])}, ${JSON.stringify(dishSeasons)}, true, ${kids_food || false}, ${JSON.stringify(dietary_tags || [])}::jsonb)
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

    const { id, name, category, description, ingredients, seasons, active, kids_food, dietary_tags } = await request.json()

    if (!id || !name || !category) {
      return NextResponse.json(
        { error: 'ID, nom et catégorie requis' },
        { status: 400 }
      )
    }

    // Par defaut, plat disponible toute l'annee
    const dishSeasons = seasons && seasons.length > 0 ? seasons : ['toutes']

    const result = await sql`
      UPDATE dishes
      SET name = ${name},
          category = ${category},
          description = ${description || ''},
          ingredients = ${JSON.stringify(ingredients || [])},
          seasons = ${JSON.stringify(dishSeasons)},
          active = ${active !== undefined ? active : true},
          kids_food = ${kids_food || false},
          dietary_tags = ${JSON.stringify(dietary_tags || [])}::jsonb,
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

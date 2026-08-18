/**
 * Surcharges de plats par client (`user_dish_overrides`).
 *
 * Un client peut ne pas manger un ingrédient : le chef le remplace, le retire,
 * en ajoute un autre, ajuste une quantité, renomme le plat — ou l'écarte quand
 * il n'est pas adaptable (une pinsa sans pâte n'existe pas).
 *
 * Ces règles sont lues à quatre endroits (catalogue client, liste de courses,
 * emails, récap). L'application est centralisée ici pour qu'un oubli à un seul
 * de ces endroits ne serve pas au client ce qu'il ne peut pas manger.
 */
import { sql } from '@vercel/postgres'

/**
 * Overrides d'un client, indexés par plat.
 *
 * Volontairement SANS filet : si la requête échoue (colonne manquante, base
 * injoignable), l'erreur remonte. Renvoyer une liste vide servirait la recette
 * du catalogue à quelqu'un qui ne peut pas la manger, sans que personne ne le
 * voie — une panne visible vaut mieux qu'une adaptation silencieusement perdue.
 */
export async function loadDishOverrides(userId) {
  const map = new Map()
  if (!userId) return map
  const result = await sql`
    SELECT dish_id, action, custom_name, custom_description,
           remove_ingredients, substitute_ingredients, add_ingredients
    FROM user_dish_overrides
    WHERE user_id = ${userId}
  `
  result.rows.forEach(r => map.set(r.dish_id, r))
  return map
}

/**
 * Overrides de PLUSIEURS clients d'un coup : Map<userId, Map<dishId, override>>.
 *
 * Le récap du chef en a besoin pour tous les clients de la semaine à la fois ;
 * les charger un par un ferait une requête par client, pour presque toujours
 * zéro règle.
 */
export async function loadDishOverridesForUsers(userIds) {
  const byUser = new Map()
  if (!userIds || userIds.length === 0) return byUser
  const result = await sql`
    SELECT user_id, dish_id, action, custom_name, custom_description,
           remove_ingredients, substitute_ingredients, add_ingredients
    FROM user_dish_overrides
    WHERE user_id = ANY(${userIds})
  `
  result.rows.forEach(r => {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Map())
    byUser.get(r.user_id).set(r.dish_id, r)
  })
  return byUser
}

/**
 * Remplacements globaux de PLUSIEURS clients : Map<userId, Map<ingredientId, remplaçant>>.
 * Complète les overrides par plat — un client peut avoir les deux.
 */
export async function loadIngredientReplacementsForUsers(userIds) {
  const byUser = new Map()
  if (!userIds || userIds.length === 0) return byUser
  const result = await sql`
    SELECT r.user_id, r.original_ingredient_id, i.id, i.name, i.category
    FROM user_ingredient_replacements r
    JOIN ingredients i ON i.id = r.replacement_ingredient_id
    WHERE r.user_id = ANY(${userIds})
  `
  result.rows.forEach(r => {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Map())
    byUser.get(r.user_id).set(r.original_ingredient_id, { id: r.id, name: r.name, category: r.category })
  })
  return byUser
}

/**
 * Métadonnées des ingrédients cibles (substitutions + ajouts), en UNE requête.
 * Sans elles, un ingrédient substitué s'afficherait sous son ancien nom.
 *
 * Accepte une Map d'overrides (un client) ou un tableau (plusieurs clients).
 */
export async function loadOverrideIngredients(overrides) {
  const list = Array.isArray(overrides) ? overrides : [...overrides.values()]
  const ids = new Set()
  for (const ov of list) {
    ;(ov.substitute_ingredients || []).forEach(s => ids.add(s.to_ingredient_id))
    ;(ov.add_ingredients || []).forEach(a => ids.add(a.ingredient_id))
  }
  const map = new Map()
  if (ids.size === 0) return map
  const result = await sql`
    SELECT id, name, category, default_unit, dietary_tags
    FROM ingredients
    WHERE id = ANY(${[...ids]}) AND active = true
  `
  result.rows.forEach(r => map.set(r.id, r))
  return map
}

/**
 * Applique un override à la liste d'ingrédients d'UN plat.
 *
 * Entrée  : [{ ingredientId, quantity, unit, ref }] — `ref` est la ligne
 *           d'origine de l'appelant, rendue telle quelle pour les ingrédients
 *           inchangés (chacun a sa propre forme de ligne).
 * Sortie  : mêmes champs + `source` : 'original' | 'substituted' | 'added'.
 *           Pour 'substituted' et 'added', le nom et la catégorie se lisent
 *           dans `loadOverrideIngredients()`.
 */
export function applyDishOverride(items, override) {
  if (!override || override.action === 'hide') return items.map(i => ({ ...i, source: 'original' }))

  const removeIds = (override.remove_ingredients || []).map(r => r.ingredient_id)
  const subs = override.substitute_ingredients || []

  const out = []
  for (const item of items) {
    if (removeIds.includes(item.ingredientId)) continue

    const sub = subs.find(s => s.from_ingredient_id === item.ingredientId)
    if (sub) {
      out.push({
        ...item,
        ingredientId: sub.to_ingredient_id,
        // Quantité facultative : sans elle, le remplaçant hérite de celle d'origine.
        quantity: sub.quantity != null ? Number(sub.quantity) : item.quantity,
        unit: sub.quantity != null && sub.unit != null ? sub.unit : item.unit,
        source: 'substituted'
      })
    } else {
      out.push({ ...item, source: 'original' })
    }
  }

  // Ajouts : « +100 g de courgette » sur un plat qui en contient déjà se cumule,
  // à condition que l'unité soit la même — sinon on garde deux lignes plutôt
  // que d'additionner des grammes avec des pièces.
  for (const add of override.add_ingredients || []) {
    const quantity = Number(add.quantity) || 0
    const unit = add.unit || null
    const existing = out.find(i => i.ingredientId === add.ingredient_id && (i.unit || null) === unit)
    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + quantity
    } else {
      out.push({ ingredientId: add.ingredient_id, quantity, unit, ref: null, source: 'added' })
    }
  }

  return out
}

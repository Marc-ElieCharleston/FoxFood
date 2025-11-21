import { sql } from '@vercel/postgres'

export { sql }

// Helper pour exécuter des requêtes
export async function query(text, params) {
  try {
    const result = await sql.query(text, params)
    return result
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

// Helper pour obtenir un utilisateur par email
export async function getUserByEmail(email) {
  const result = await sql`
    SELECT * FROM users WHERE email = ${email} LIMIT 1
  `
  return result.rows[0]
}

// Helper pour obtenir un utilisateur par ID
export async function getUserById(id) {
  const result = await sql`
    SELECT id, email, name, phone, role, created_at FROM users WHERE id = ${id} LIMIT 1
  `
  return result.rows[0]
}

// Helper pour créer un utilisateur
export async function createUser({ email, name, password, phone = null, role = 'client' }) {
  const result = await sql`
    INSERT INTO users (email, name, password, phone, role)
    VALUES (${email}, ${name}, ${password}, ${phone}, ${role})
    RETURNING id, email, name, phone, role, created_at
  `
  return result.rows[0]
}

// Helper pour obtenir tous les plats actifs
export async function getActiveDishes() {
  const result = await sql`
    SELECT * FROM dishes WHERE active = true ORDER BY category, name
  `
  return result.rows
}

// Helper pour obtenir les plats par catégorie
export async function getDishesByCategory(category) {
  const result = await sql`
    SELECT * FROM dishes WHERE category = ${category} AND active = true ORDER BY name
  `
  return result.rows
}

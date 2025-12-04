import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET - Récupérer tous les tags alimentaires disponibles
export async function GET() {
  try {
    const result = await sql`
      SELECT * FROM dietary_tags ORDER BY name ASC
    `
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

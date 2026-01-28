import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runMigrations } from '@/lib/migrations'

/**
 * POST /api/admin/migrations
 * Exécuter les migrations en attente (admin uniquement)
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    // Sécurité : uniquement les admins peuvent exécuter les migrations
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }

    console.log(`🔧 Admin ${session.user.name} a déclenché les migrations`)

    const success = await runMigrations()

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Migrations exécutées avec succès'
      })
    } else {
      return NextResponse.json(
        { error: 'Erreur lors de l\'exécution des migrations' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Erreur API migrations:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/migrations
 * Vérifier l'état des migrations
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }

    // Pour l'instant, on retourne juste un statut OK
    // On pourrait améliorer en listant les migrations exécutées/en attente
    return NextResponse.json({
      status: 'ready',
      message: 'Système de migrations prêt'
    })
  } catch (error) {
    console.error('Erreur vérification migrations:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

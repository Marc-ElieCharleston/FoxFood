import { NextResponse } from 'next/server'
import { processReminders } from '@/lib/reminder-scheduler'

/**
 * Cron job pour envoyer les rappels quotidiens
 *
 * Configuration Vercel Cron (dans vercel.json) :
 * {
 *   "crons": [{
 *     "path": "/api/cron/send-reminders",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 *
 * Cela s'exécutera tous les jours à 9h00 (UTC)
 */

export async function GET(request) {
  // Vérification de sécurité : s'assurer que la requête vient de Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Non autorisé' },
      { status: 401 }
    )
  }

  try {
    console.log('🔔 Début du traitement des rappels quotidiens...')

    const results = await processReminders()

    console.log('✅ Traitement terminé:', results)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    })
  } catch (error) {
    console.error('❌ Erreur lors du traitement des rappels:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Support pour POST aussi (Vercel Cron peut utiliser POST)
export async function POST(request) {
  return GET(request)
}

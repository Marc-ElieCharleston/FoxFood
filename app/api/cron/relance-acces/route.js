import { NextResponse } from 'next/server'
import { relancerDemandesEnAttente } from '@/lib/notifications'

/**
 * Relance des demandes d'accès restées sans réponse.
 *
 * Le cron quotidien (`/api/cron/send-reminders`) appelle déjà cette relance.
 * Cette route existe pour la déclencher SEULE : rejouer le cron complet
 * renverrait aussi les rappels clients du jour, ce qu'on ne veut pas.
 *
 *   ?dryRun=1       liste qui serait relancé, sans rien envoyer ni journaliser
 *   ?ignorerDelai=1 rattrape un retard déjà constaté sans attendre le délai
 *                   (le plafond de 3 relances par personne, lui, tient toujours)
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'
  const ignorerDelai = searchParams.get('ignorerDelai') === '1'

  try {
    const result = await relancerDemandesEnAttente({ dryRun, ignorerDelai })
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ...result
    })
  } catch (error) {
    console.error('Erreur relance demandes d\'accès:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  return GET(request)
}

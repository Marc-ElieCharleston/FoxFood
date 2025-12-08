import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@foxfood.fr'

/**
 * Envoyer un email de test via Resend
 */
async function sendTestEmail({ to, type, daysBeforeDelivery }) {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY non configurée' }
  }

  const templates = {
    reminder: {
      subject: `[TEST] Rappel: Sélectionnez vos plats - ${daysBeforeDelivery} jour(s) restant(s)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #fef3c7; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>🧪 Ceci est un email de TEST</strong>
          </div>
          <h2>Bonjour ! 👋</h2>
          <p>Emeric passe dans <strong>${daysBeforeDelivery} jour(s)</strong> !</p>
          <p>N'oubliez pas de sélectionner vos plats pour cette semaine.</p>
          <p style="margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL || 'https://foxfood.fr'}"
               style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Choisir mes plats
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            À bientôt,<br/>
            L'équipe FoxFood
          </p>
        </div>
      `
    },
    selection: {
      subject: '[TEST] Un client a fait sa sélection',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #fef3c7; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>🧪 Ceci est un email de TEST</strong>
          </div>
          <h2>Nouvelle sélection 🎉</h2>
          <p><strong>Client Test</strong> (test@example.com) a terminé sa sélection :</p>
          <ul style="margin: 20px 0;">
            <li>Poulet rôti aux herbes</li>
            <li>Gratin dauphinois</li>
            <li>Tarte aux pommes</li>
          </ul>
          <p style="color: #666; font-size: 14px;">
            FoxFood - Notifications admin
          </p>
        </div>
      `
    },
    missing: {
      subject: '[TEST] Client sans sélection',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #fef3c7; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>🧪 Ceci est un email de TEST</strong>
          </div>
          <h2>Sélection manquante ⚠️</h2>
          <p><strong>Client Test</strong> (test@example.com) n'a pas encore sélectionné ses plats.</p>
          <p>Son passage est prévu dans <strong>${daysBeforeDelivery} jour(s)</strong>.</p>
          <p style="color: #666; font-size: 14px;">
            FoxFood - Notifications admin
          </p>
        </div>
      `
    }
  }

  const template = templates[type] || templates.reminder

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject: template.subject,
        html: template.html
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Erreur Resend: ${error}`)
    }

    const data = await response.json()

    // Logger dans notifications_log
    await sql`
      INSERT INTO notifications_log (
        notification_type,
        recipient_email,
        method,
        subject,
        content,
        status
      ) VALUES (
        'test_email',
        ${to},
        'email',
        ${template.subject},
        ${template.html},
        'sent'
      )
    `

    return { success: true, id: data.id }
  } catch (error) {
    console.error('Erreur envoi email test:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Simuler l'envoi d'un SMS de test
 */
async function sendTestSMS({ to, type, daysBeforeDelivery }) {
  const templates = {
    reminder: `[TEST] FoxFood: Emeric passe dans ${daysBeforeDelivery} jour(s). N'oubliez pas de sélectionner vos plats!`,
    selection: `[TEST] FoxFood: Client Test a fait sa sélection de 3 plat(s).`,
    missing: `[TEST] FoxFood: Client Test n'a pas encore fait sa sélection. Passage dans ${daysBeforeDelivery} jour(s).`
  }

  const message = templates[type] || templates.reminder

  // Pour l'instant on simule - TODO: intégrer OVH SMS
  console.log(`SMS TEST simulé vers ${to}: ${message}`)

  // Logger dans notifications_log
  await sql`
    INSERT INTO notifications_log (
      notification_type,
      recipient_phone,
      method,
      content,
      status
    ) VALUES (
      'test_sms',
      ${to},
      'sms',
      ${message},
      'simulated'
    )
  `

  return { success: true, simulated: true, message }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { type, method, email, phone, daysBeforeDelivery = 1 } = await request.json()

    const results = {}

    if (method === 'email' || method === 'both') {
      if (!email) {
        return NextResponse.json({ error: 'Email requis' }, { status: 400 })
      }
      results.email = await sendTestEmail({ to: email, type, daysBeforeDelivery })
    }

    if (method === 'sms' || method === 'both') {
      if (!phone) {
        return NextResponse.json({ error: 'Téléphone requis' }, { status: 400 })
      }
      results.sms = await sendTestSMS({ to: phone, type, daysBeforeDelivery })
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Erreur test notification:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

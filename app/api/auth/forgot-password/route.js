import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request) {
  try {
    const { email } = await request.json()

    // Validation
    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      )
    }

    // Vérifier si l'utilisateur existe
    const userResult = await sql`
      SELECT id, name, email FROM users WHERE email = ${email.trim().toLowerCase()}
    `

    // Pour des raisons de sécurité, ne pas révéler si l'email existe ou non
    // On retourne toujours un succès, mais on envoie l'email seulement si l'utilisateur existe
    if (userResult.rows.length === 0) {
      // Attendre un peu pour éviter le timing attack
      await new Promise(resolve => setTimeout(resolve, 500))
      return NextResponse.json({
        message: 'Si cet email existe dans notre système, vous recevrez un lien de réinitialisation.'
      })
    }

    const user = userResult.rows[0]

    // Générer un token unique et sécurisé
    const token = crypto.randomBytes(32).toString('hex')

    // Expiration dans 24 heures
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Supprimer les anciens tokens non utilisés pour cet utilisateur
    await sql`
      DELETE FROM password_reset_tokens
      WHERE user_id = ${user.id}
      AND used_at IS NULL
    `

    // Créer le nouveau token
    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt})
    `

    // Envoyer l'email avec le lien de réinitialisation
    try {
      const { sendEmail } = await import('@/lib/notifications')

      const resetLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${token}`

      await sendEmail({
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe FoxFood',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f97316;">Réinitialisation de mot de passe</h2>
            <p>Bonjour ${user.name},</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe sur FoxFood.</p>
            <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}"
                 style="background-color: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Ce lien est valable pendant 24 heures.<br>
              Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
              <span style="word-break: break-all;">${resetLink}</span>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              FoxFood - Plats préparés par Emeric
            </p>
          </div>
        `
      })

      // Logger la notification
      await sql`
        INSERT INTO notifications_log (
          notification_type,
          recipient_email,
          method,
          subject,
          status
        )
        VALUES (
          'password_reset',
          ${user.email},
          'email',
          'Réinitialisation de votre mot de passe FoxFood',
          'sent'
        )
      `
    } catch (emailError) {
      console.error('Erreur envoi email:', emailError)
      // Ne pas bloquer la requête si l'email échoue
      // On peut logger l'erreur pour investigation
    }

    return NextResponse.json({
      message: 'Si cet email existe dans notre système, vous recevrez un lien de réinitialisation.'
    })
  } catch (error) {
    console.error('Erreur forgot-password:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la demande de réinitialisation' },
      { status: 500 }
    )
  }
}

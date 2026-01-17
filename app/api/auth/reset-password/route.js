import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request) {
  try {
    const { token, password } = await request.json()

    // Validation
    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: 'Token requis' },
        { status: 400 }
      )
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    // Vérifier si le token existe et est valide
    const tokenResult = await sql`
      SELECT
        prt.id as token_id,
        prt.user_id,
        prt.expires_at,
        prt.used_at,
        u.email,
        u.name
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token = ${token.trim()}
    `

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Token invalide ou expiré' },
        { status: 400 }
      )
    }

    const tokenData = tokenResult.rows[0]

    // Vérifier si le token a déjà été utilisé
    if (tokenData.used_at) {
      return NextResponse.json(
        { error: 'Ce lien a déjà été utilisé' },
        { status: 400 }
      )
    }

    // Vérifier si le token a expiré
    const now = new Date()
    const expiresAt = new Date(tokenData.expires_at)

    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Ce lien a expiré. Veuillez faire une nouvelle demande.' },
        { status: 400 }
      )
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 10)

    // Mettre à jour le mot de passe
    await sql`
      UPDATE users
      SET password = ${hashedPassword}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${tokenData.user_id}
    `

    // Marquer le token comme utilisé
    await sql`
      UPDATE password_reset_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ${tokenData.token_id}
    `

    // Supprimer tous les autres tokens non utilisés pour cet utilisateur
    await sql`
      DELETE FROM password_reset_tokens
      WHERE user_id = ${tokenData.user_id}
      AND id != ${tokenData.token_id}
      AND used_at IS NULL
    `

    // Envoyer un email de confirmation
    try {
      const { sendEmail } = await import('@/lib/notifications')

      await sendEmail({
        to: tokenData.email,
        subject: 'Votre mot de passe a été réinitialisé',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Mot de passe modifié avec succès</h2>
            <p>Bonjour ${tokenData.name},</p>
            <p>Votre mot de passe FoxFood a été réinitialisé avec succès.</p>
            <p>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login"
                 style="background-color: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                Se connecter
              </a>
            </div>
            <p style="color: #dc2626; font-size: 14px; background-color: #fee2e2; padding: 12px; border-radius: 8px;">
              ⚠️ Si vous n'avez pas effectué cette modification, veuillez contacter Emeric immédiatement.
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
          'password_reset_confirmation',
          ${tokenData.email},
          'email',
          'Votre mot de passe a été réinitialisé',
          'sent'
        )
      `
    } catch (emailError) {
      console.error('Erreur envoi email confirmation:', emailError)
      // Ne pas bloquer la réinitialisation si l'email échoue
    }

    return NextResponse.json({
      message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
    })
  } catch (error) {
    console.error('Erreur reset-password:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la réinitialisation du mot de passe' },
      { status: 500 }
    )
  }
}

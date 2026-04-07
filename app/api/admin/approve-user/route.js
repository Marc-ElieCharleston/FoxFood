import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

/**
 * GET via lien email tokenisé (pas besoin d'être connecté)
 * Query params: token, action (approve|reject)
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const action = searchParams.get('action')

  if (!token || !['approve', 'reject'].includes(action)) {
    return htmlResponse('❌ Lien invalide', 'Le lien de validation est invalide.', false)
  }

  // Trouver l'utilisateur par token
  const userResult = await sql`
    SELECT id, name, email, approval_status FROM users WHERE approval_token = ${token}
  `
  if (userResult.rows.length === 0) {
    return htmlResponse('❌ Lien expiré', 'Ce lien de validation est invalide ou a déjà été utilisé.', false)
  }

  const user = userResult.rows[0]

  if (user.approval_status !== 'pending') {
    return htmlResponse(
      `ℹ️ Déjà traité`,
      `Le compte de ${user.name} (${user.email}) est déjà ${user.approval_status === 'approved' ? 'validé' : 'refusé'}.`,
      true
    )
  }

  // Mettre à jour le statut
  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  await sql`
    UPDATE users
    SET approval_status = ${newStatus},
        approved_at = NOW(),
        approval_token = NULL,
        updated_at = NOW()
    WHERE id = ${user.id}
  `

  if (action === 'approve') {
    return htmlResponse(
      '✅ Compte validé',
      `Le compte de <strong>${user.name}</strong> (${user.email}) a été validé. La personne peut maintenant accéder à FoxFood.`,
      true
    )
  } else {
    return htmlResponse(
      '❌ Compte refusé',
      `Le compte de <strong>${user.name}</strong> (${user.email}) a été refusé. La personne ne pourra pas accéder à l'application.`,
      true
    )
  }
}

/**
 * POST authentifié (admin connecté via /admin/utilisateurs)
 * Body: { userId, action: 'approve'|'reject' }
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { userId, action } = await request.json()
    if (!userId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const result = await sql`
      UPDATE users
      SET approval_status = ${newStatus},
          approved_at = NOW(),
          approved_by = ${session.user.id},
          approval_token = NULL,
          updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, name, email, approval_status
    `
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ success: true, user: result.rows[0] })
  } catch (error) {
    console.error('Erreur approbation utilisateur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function htmlResponse(title, message, success) {
  const color = success ? '#16a34a' : '#dc2626'
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FoxFood - ${title}</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px; }
    .card { max-width: 480px; margin: 60px auto; background: white; padding: 40px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; }
    h1 { color: ${color}; margin: 0 0 16px; }
    p { color: #374151; line-height: 1.6; }
    a { display: inline-block; margin-top: 24px; color: #ea580c; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://foxfood.fr">Retour à FoxFood</a>
  </div>
</body>
</html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sql, getUserByEmail } from '@/lib/db'
import { notifyAdminPendingUser } from '@/lib/notifications'

export async function POST(request) {
  try {
    const { email, name, password, phone } = await request.json()

    // Validation
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Email, nom et mot de passe sont requis' },
        { status: 400 }
      )
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cet email' },
        { status: 400 }
      )
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10)

    // Créer l'utilisateur en attente de validation par l'admin
    const approvalToken = crypto.randomBytes(32).toString('hex')
    const result = await sql`
      INSERT INTO users (email, name, password, phone, role, approval_status, approval_token, approval_requested_at)
      VALUES (${email}, ${name}, ${hashedPassword}, ${phone || null}, 'client', 'pending', ${approvalToken}, NOW())
      RETURNING id, email, name, phone
    `
    const user = result.rows[0]

    // Notifier l'admin (asynchrone, on ne bloque pas si ça échoue)
    try {
      await notifyAdminPendingUser({ pendingUser: user, approvalToken })
    } catch (notifError) {
      console.error('Erreur notification admin:', notifError)
    }

    return NextResponse.json(
      {
        message: 'Compte créé avec succès. Un administrateur doit valider votre accès avant que vous puissiez vous connecter.',
        pending: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erreur lors de la création du compte:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du compte' },
      { status: 500 }
    )
  }
}

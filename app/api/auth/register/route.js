import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createUser, getUserByEmail } from '@/lib/db'

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

    // Créer l'utilisateur
    const user = await createUser({
      email,
      name,
      password: hashedPassword,
      phone,
      role: 'client'
    })

    return NextResponse.json(
      {
        message: 'Compte créé avec succès',
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

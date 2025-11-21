import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { getUserByEmail, createUser } from './db'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email et mot de passe requis')
        }

        const user = await getUserByEmail(credentials.email)

        if (!user) {
          throw new Error('Aucun compte trouvé avec cet email')
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error('Mot de passe incorrect')
        }

        // Ne pas retourner le mot de passe
        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Pour Google OAuth, créer automatiquement un compte si il n'existe pas
      if (account.provider === 'google') {
        const existingUser = await getUserByEmail(user.email)

        if (!existingUser) {
          // Créer un nouveau compte client
          await createUser({
            email: user.email,
            name: user.name,
            password: '', // Pas de mot de passe pour OAuth
            role: 'client'
          })
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      // Lors de la première connexion
      if (user) {
        const dbUser = await getUserByEmail(user.email)
        if (dbUser) {
          token.role = dbUser.role
          token.id = dbUser.id.toString()
          token.phone = dbUser.phone
        }
      }
      return token
    },
    async session({ session, token }) {
      // Ajouter le rôle et l'ID à la session
      if (session.user) {
        session.user.role = token.role
        session.user.id = token.id
        session.user.phone = token.phone
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
  secret: process.env.NEXTAUTH_SECRET,
}

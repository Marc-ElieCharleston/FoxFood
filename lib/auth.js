import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getUserByEmail, getUserById } from './db'

export const authOptions = {
  providers: [
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
    async jwt({ token, user }) {
      // Ajouter le rôle au token lors de la connexion
      if (user) {
        token.role = user.role
        token.id = user.id
        token.phone = user.phone
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

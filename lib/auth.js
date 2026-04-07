import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getUserByEmail, createUser } from './db'
import { sql } from './db'
import { notifyAdminPendingUser } from './notifications'

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
      // Pour Google OAuth, créer automatiquement un compte si il n'existe pas (statut pending)
      if (account.provider === 'google') {
        const existingUser = await getUserByEmail(user.email)

        if (!existingUser) {
          // Créer un nouveau compte client en attente de validation
          const approvalToken = crypto.randomBytes(32).toString('hex')
          const inserted = await sql`
            INSERT INTO users (email, name, password, role, approval_status, approval_token, approval_requested_at)
            VALUES (${user.email}, ${user.name}, '', 'client', 'pending', ${approvalToken}, NOW())
            RETURNING id, email, name, phone
          `
          // Notifier l'admin
          try {
            await notifyAdminPendingUser({ pendingUser: inserted.rows[0], approvalToken })
          } catch (e) {
            console.error('Erreur notification admin:', e)
          }
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      // Toujours rafraîchir les données utilisateur depuis la DB
      // pour éviter les valeurs obsolètes (onboarding_completed, household_id, etc.)
      const email = user?.email || token.email

      if (email) {
        const dbUser = await getUserByEmail(email)
        if (dbUser) {
          token.role = dbUser.role
          token.id = dbUser.id.toString()
          token.phone = dbUser.phone
          token.email = dbUser.email
          token.onboarding_completed = dbUser.onboarding_completed || false
          token.household_size = dbUser.household_size || 1
          token.household_id = dbUser.household_id || null
          token.approval_status = dbUser.approval_status || 'approved'
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
        session.user.onboarding_completed = token.onboarding_completed
        session.user.household_size = token.household_size
        session.user.household_id = token.household_id
        session.user.approval_status = token.approval_status
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
    maxAge: 90 * 24 * 60 * 60, // 90 jours (3 mois) - Petite appli familiale, pas besoin de se reconnecter souvent
    updateAge: 24 * 60 * 60, // Extend la session tous les jours d'activité
  },
  secret: process.env.NEXTAUTH_SECRET,
}

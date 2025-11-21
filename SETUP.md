# Configuration FoxFood

## Étapes de configuration

### 1. Créer la base de données Vercel Postgres

1. Allez sur https://vercel.com/dashboard
2. Sélectionnez votre projet FoxFood
3. Allez dans l'onglet **Storage**
4. Cliquez sur **Create Database**
5. Choisissez **Postgres**
6. Nommez-la `foxfood-db` et cliquez sur **Create**

### 2. Initialiser le schéma de la base de données

Une fois la base créée :

1. Dans l'onglet **Storage**, cliquez sur votre base de données
2. Allez dans l'onglet **Query**
3. Copiez tout le contenu du fichier `sql/schema.sql`
4. Collez-le dans l'éditeur de requêtes
5. Cliquez sur **Run Query**

Cela créera toutes les tables nécessaires et les 2 comptes admin par défaut.

### 3. Configurer les variables d'environnement locales

1. Copiez `.env.example` vers `.env.local` :
```bash
cp .env.example .env.local
```

2. Dans l'onglet **Storage** > votre base de données > **Settings** > **General**, copiez la connexion string

3. Éditez `.env.local` et ajoutez :
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<généré avec: openssl rand -base64 32>
POSTGRES_URL=<copiée depuis Vercel>
POSTGRES_PRISMA_URL=<copiée depuis Vercel>
POSTGRES_URL_NON_POOLING=<copiée depuis Vercel>
POSTGRES_USER=<copiée depuis Vercel>
POSTGRES_HOST=<copiée depuis Vercel>
POSTGRES_PASSWORD=<copiée depuis Vercel>
POSTGRES_DATABASE=<copiée depuis Vercel>
```

Ou plus simplement, dans Vercel Storage > votre DB > **.env.local** tab, cliquez sur **Copy Snippet** et collez tout dans votre `.env.local`.

4. Ajoutez votre NEXTAUTH_SECRET :
```bash
openssl rand -base64 32
```
Copiez le résultat et ajoutez-le dans `.env.local`.

### 4. Démarrer l'application

```bash
npm run dev
```

### 5. Tester l'authentification

Comptes admin par défaut (à changer en production !) :
- **Email**: `emeric@foxfood.com` ou `dev@foxfood.com`
- **Mot de passe**: `admin123`

### 6. Configuration Vercel (production)

1. Allez dans **Settings** > **Environment Variables**
2. Ajoutez `NEXTAUTH_SECRET` (généré avec openssl)
3. Ajoutez `NEXTAUTH_URL` = `https://votre-domaine.vercel.app`
4. Les variables Postgres sont automatiquement injectées par Vercel

### 7. (Optionnel) Configurer Resend pour les emails

1. Créez un compte sur https://resend.com (gratuit 3000 emails/mois)
2. Créez une API key
3. Ajoutez dans `.env.local` et dans Vercel :
```env
RESEND_API_KEY=re_xxxxx
```

## Prochaines étapes

Une fois la configuration terminée, vous pourrez :
- Créer des comptes clients
- Accéder à l'interface admin (`/admin`)
- Gérer les plats
- Faire des sélections hebdomadaires
- Recevoir des rappels automatiques

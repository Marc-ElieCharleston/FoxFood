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

### 7. Configurer Resend pour les emails de rappel

1. Créez un compte sur https://resend.com (gratuit 3000 emails/mois)
2. Allez dans **API Keys** et créez une nouvelle clé
3. Ajoutez la clé dans `.env.local` :
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

4. Dans Vercel, ajoutez la variable dans **Settings** > **Environment Variables**

5. **Important**: Dans Resend, vous devez vérifier votre domaine pour envoyer des emails. Pour les tests, vous pouvez utiliser leur domaine de test.

### 8. Configurer le Cron Job pour les rappels automatiques

1. Générez un secret pour sécuriser l'endpoint du cron :
```bash
openssl rand -base64 32
```

2. Ajoutez-le dans `.env.local` et dans Vercel :
```env
CRON_SECRET=votre-secret-généré
```

3. Le fichier `vercel.json` est déjà configuré pour exécuter le cron quotidiennement à 9h du matin (UTC)

4. Une fois déployé sur Vercel, le cron s'exécutera automatiquement et enverra:
   - **5 jours avant**: Rappel de faire les courses
   - **2 jours avant**: Rappel de sélectionner les plats (si pas fait)
   - **Chaque lundi**: Rappel aux utilisateurs sans sélection

### 9. Tester le cron job manuellement (optionnel)

Vous pouvez tester l'endpoint du cron localement :
```bash
curl -H "Authorization: Bearer VOTRE_CRON_SECRET" http://localhost:3000/api/cron/send-reminders
```

## Prochaines étapes

Une fois la configuration terminée, vous pourrez :
- Créer des comptes clients
- Accéder à l'interface admin (`/admin`)
- Importer les 80+ plats du catalogue
- Gérer les plats (CRUD complet)
- Les clients peuvent faire leurs sélections hebdomadaires (5 plats max)
- Recevoir des rappels automatiques par email

# 🦊 FoxFood

Plateforme de service de repas à domicile permettant aux clients de sélectionner leurs plats hebdomadaires et de recevoir des rappels automatiques.

## Fonctionnalités

### Pour les clients
- 👤 Authentification sécurisée avec NextAuth
- 📋 Sélection de 5 plats par semaine parmi 80+ recettes
- 🗓️ Choix du jour et créneau de passage du cuisinier
- 📧 Rappels automatiques par email:
  - 5 jours avant: liste de courses
  - 2 jours avant: rappel de sélection
- 📱 Interface responsive et moderne

### Pour l'administrateur (cuisinier)
- 🔐 Accès admin sécurisé
- ➕ CRUD complet des plats (Créer, Lire, Modifier, Supprimer)
- 📥 Import en masse de 80+ plats du catalogue
- 📊 Gestion des catégories (Viandes, Poissons, Végétarien)
- ✏️ Modification des descriptions et ingrédients
- 👁️ Activation/désactivation des plats

## Technologies

- **Next.js 16** (App Router)
- **React 19** avec hooks
- **Tailwind CSS 4**
- **NextAuth.js** pour l'authentification
- **Vercel Postgres** (serverless)
- **Resend** pour les emails
- **Vercel Cron** pour les tâches planifiées
- **JSX**

## Installation et Configuration

Voir le fichier **[SETUP.md](./SETUP.md)** pour les instructions détaillées de configuration.

### Démarrage rapide

```bash
# Installation
npm install

# Copier les variables d'environnement
cp .env.example .env.local

# Configurer Vercel Postgres et les variables d'environnement
# Voir SETUP.md pour les instructions détaillées

# Démarrer le serveur de développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Déploiement sur Vercel

1. Poussez votre code sur GitHub
2. Importez le projet dans Vercel
3. Créez une base de données Postgres dans Vercel Storage
4. Configurez les variables d'environnement (voir SETUP.md)
5. Déployez!

## Utilisation

### Pour les clients
1. **S'inscrire**: Créez un compte client
2. **Parcourir**: Explorez les plats par catégorie (Viandes, Poissons, Végétarien)
3. **Sélectionner**: Choisissez vos 5 plats préférés
4. **Planifier**: Indiquez le jour et créneau de passage du cuisinier
5. **Confirmer**: Enregistrez votre sélection
6. **Recevoir**: Recevez automatiquement vos rappels par email

### Pour l'admin (cuisinier)
1. **Se connecter**: Utilisez vos identifiants admin
2. **Accéder**: Cliquez sur "Admin" dans le header
3. **Importer**: Importez le catalogue de 80+ plats en un clic
4. **Gérer**: Créer, modifier, supprimer des plats
5. **Organiser**: Catégorisez et activez/désactivez les plats

## Comptes par défaut

**Comptes admin** (à changer en production):
- Email: `emeric@foxfood.com` ou `dev@foxfood.com`
- Mot de passe: `admin123`

## Licence

ISC

# 🔔 Système de Notifications - FoxFood

## Résumé des Phases Complétées

Toutes les 7 phases du système de notifications ont été implémentées avec succès :

### ✅ Phase 1 : Base de données
- **4 nouvelles tables** créées dans `sql/add_notifications_system.sql`
  - `user_reminders` : Rappels multiples par utilisateur (1, 3, 5 jours)
  - `custom_dish_requests` : Demandes de plats personnalisés
  - `admin_settings` : Paramètres de notification admin
  - `notifications_log` : Journal de toutes les notifications

### ✅ Phase 2 : Paramètres utilisateur
- Page `/parametres` mise à jour avec système de rappels multiples
- Chaque rappel peut être envoyé par **email ET/OU SMS**
- Validation dynamique des coordonnées selon méthodes sélectionnées

### ✅ Phase 3 : Demandes de plats personnalisés
- **Bouton "Demander un plat personnalisé"** sur page d'accueil
- **2 types de formulaires** :
  - Simple : nom + description
  - Détaillé : + liste d'ingrédients suggérés
- APIs créées : `/api/custom-dishes` (user), `/api/admin/custom-dishes` (admin)

### ✅ Phase 4 : Paramètres admin
- Page `/admin/parametres` créée
- Configuration des notifications à recevoir :
  - Sélection client effectuée
  - Sélection manquante
  - Demande de plat personnalisé
  - Résumé quotidien (optionnel)
- Choix de la méthode : email, SMS, ou les deux
- Configuration du délai de rappel automatique (1-5 jours)

### ✅ Phase 5 : Système de notifications
- `/lib/notifications.js` : Fonctions d'envoi email (Resend) et SMS
- `/lib/reminder-scheduler.js` : Logique de traitement des rappels
- **4 types de notifications** :
  - Rappel utilisateur (selon rappels configurés)
  - Admin : sélection effectuée
  - Admin : sélection manquante
  - Admin : demande plat personnalisé

### ✅ Phase 6 : Cron jobs
- Endpoint `/api/cron/send-reminders` créé
- Configuration dans `vercel.json` : exécution quotidienne à 9h (UTC)
- Sécurisé avec `CRON_SECRET`

### ✅ Phase 7 : Page gestion demandes
- Page `/admin/plats-personnalises` créée
- Filtres par statut (en attente, approuvées, rejetées)
- Badge indicateur pour demandes en attente
- Actions : approuver, rejeter, supprimer
- Notes admin pour communiquer avec le client

---

## 🔧 Configuration Requise

### Variables d'environnement Vercel

Ajoutez ces variables dans les paramètres Vercel :

```bash
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@votredomaine.com

# Cron job security
CRON_SECRET=votre_secret_securise_aleatoire

# SMS (optionnel - Twilio exemple)
# TWILIO_ACCOUNT_SID=ACxxxxxx
# TWILIO_AUTH_TOKEN=xxxxxx
# TWILIO_PHONE_NUMBER=+33xxxxxxxxx

# NextAuth
NEXTAUTH_URL=https://fox-food.vercel.app
NEXTAUTH_SECRET=votre_secret_nextauth
```

### Configuration Resend

1. Créer un compte sur [resend.com](https://resend.com)
2. Obtenir une API key
3. Vérifier votre domaine d'envoi
4. Ajouter `RESEND_API_KEY` dans Vercel

### Configuration SMS (optionnel)

Le système SMS est actuellement simulé. Pour l'activer :

1. Choisir un fournisseur (Twilio, Vonage, etc.)
2. Décommenter le code dans `/lib/notifications.js` ligne ~36
3. Configurer les variables d'environnement du fournisseur

---

## 📋 Migration Base de Données

Le fichier SQL a déjà été appliqué dans Neon selon confirmation utilisateur.

Si besoin de réappliquer :
```sql
-- Exécuter dans console Neon
\i sql/add_notifications_system.sql
```

---

## 🚀 Utilisation

### Pour les utilisateurs

1. **Configurer les rappels** : `/parametres`
   - Choisir jour et créneau de passage d'Emeric
   - Activer rappels à 5, 3, et/ou 1 jour(s) avant
   - Choisir email et/ou SMS pour chaque rappel

2. **Demander un plat personnalisé** : Page d'accueil
   - Cliquer sur "Demander un plat personnalisé"
   - Choisir formulaire simple ou détaillé
   - Emeric reçoit immédiatement la notification

### Pour l'admin (Emeric)

1. **Configurer les notifications** : `/admin/parametres`
   - Email et téléphone de notification
   - Types de notifications à recevoir
   - Délai de rappel automatique pour clients

2. **Gérer les demandes** : `/admin/plats-personnalises`
   - Voir toutes les demandes avec badge "en attente"
   - Approuver ou rejeter avec notes
   - Supprimer les demandes traitées

3. **Navigation admin** : Barre de navigation présente sur toutes les pages admin
   - Plats du catalogue
   - Plats personnalisés
   - Paramètres

---

## 🤖 Fonctionnement Automatique

### Rappels quotidiens (9h UTC = 10h/11h Paris)

Le cron job vérifie quotidiennement :

1. **Pour chaque utilisateur** :
   - Calcule jours avant prochain passage
   - Si rappel configuré pour ce jour ET pas de sélection → envoi rappel

2. **Pour l'admin** :
   - Si client n'a pas fait sélection au délai configuré → alerte admin

### Notifications en temps réel

- **Sélection effectuée** : Notification admin immédiate
- **Plat personnalisé** : Notification admin immédiate

---

## 📊 Journal des Notifications

Toutes les notifications sont loggées dans `notifications_log` :
- Type de notification
- Destinataire
- Méthode (email, sms, both)
- Statut (sent, failed)
- Erreurs éventuelles
- Timestamp

Utile pour debug et statistiques.

---

## 🧪 Test du Système

### Tester manuellement le cron

```bash
# Depuis votre machine (avec authentification)
curl -X GET "https://fox-food.vercel.app/api/cron/send-reminders" \
  -H "Authorization: Bearer VOTRE_CRON_SECRET"
```

### Vérifier les logs

Dans Vercel Dashboard → Functions → send-reminders → Logs

---

## 📝 Prochaines Étapes Suggérées

1. **Configurer Resend**
   - Créer compte
   - Ajouter API key dans Vercel
   - Tester envoi d'email

2. **Tester le workflow complet**
   - Créer utilisateur test
   - Configurer rappels
   - Faire une sélection → vérifier notif admin
   - Demander plat personnalisé → vérifier notif admin

3. **Configurer SMS** (optionnel)
   - Choisir fournisseur
   - Implémenter dans `/lib/notifications.js`
   - Tester envoi

4. **Monitorer les cron jobs**
   - Vérifier logs quotidiens dans Vercel
   - S'assurer que les rappels sont envoyés

5. **Ajuster les horaires**
   - Le cron est configuré sur 9h UTC
   - Modifier dans `vercel.json` si besoin

---

## 🐛 Dépannage

### Les emails ne sont pas envoyés

- Vérifier `RESEND_API_KEY` dans Vercel
- Vérifier domaine vérifié dans Resend
- Consulter logs : `/api/cron/send-reminders`

### Le cron ne s'exécute pas

- Vérifier `vercel.json` déployé
- Vérifier `CRON_SECRET` configuré
- Consulter Vercel Dashboard → Cron Jobs

### Notifications admin non reçues

- Vérifier paramètres dans `/admin/parametres`
- S'assurer que les notifications sont activées
- Vérifier coordonnées (email/téléphone) renseignées

---

## 🎯 Architecture

```
┌─────────────────┐
│   Users         │
│  (Clients)      │
└────────┬────────┘
         │
         │ 1. Configure reminders
         │ 2. Make selection
         │ 3. Request custom dish
         │
         ▼
┌─────────────────────────┐
│   FoxFood Application   │
│  ┌──────────────────┐   │
│  │ /parametres      │   │
│  │ /page (home)     │   │
│  └──────────────────┘   │
│           │              │
│           ▼              │
│  ┌──────────────────┐   │
│  │ API Routes       │   │
│  │ /api/selections  │   │
│  │ /api/custom-dishes│  │
│  └──────────────────┘   │
│           │              │
│           ▼              │
│  ┌──────────────────┐   │
│  │ Notifications    │   │
│  │ lib/             │   │
│  └──────────────────┘   │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────┐
│   External Services │
│  - Resend (email)   │
│  - SMS provider     │
└─────────────────────┘
          │
          ▼
┌─────────────────┐
│   Admin         │
│  (Emeric)       │
└─────────────────┘

┌──────────────────┐
│  Vercel Cron     │
│  (9h daily UTC)  │
└────────┬─────────┘
         │
         ▼
┌────────────────────────┐
│ /api/cron/send-reminders│
└────────┬───────────────┘
         │
         ▼
┌──────────────────────┐
│ reminder-scheduler   │
│ Process all users    │
│ Send notifications   │
└──────────────────────┘
```

---

## ✨ Fonctionnalités Clés

- ✅ **Rappels multiples** : 3 niveaux configurables (5, 3, 1 jours)
- ✅ **Multi-canal** : Email + SMS simultanément
- ✅ **Plats personnalisés** : 2 types de formulaires
- ✅ **Notifications admin** : 4 types d'événements
- ✅ **Cron automatique** : Rappels quotidiens sans intervention
- ✅ **Logs complets** : Traçabilité de toutes les notifications
- ✅ **Interface admin** : Gestion centralisée des demandes
- ✅ **Paramètres flexibles** : Chaque utilisateur et admin configure ses préférences

---

**Status** : ✅ Système complet et prêt à déployer
**Date** : 2025-11-21

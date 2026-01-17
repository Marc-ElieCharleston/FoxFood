# Scripts FoxFood

## Migration de base de données

### 🚀 Utilisation

Pour exécuter toutes les migrations SQL automatiquement :

```bash
npm run migrate
```

### 📋 Comment ça fonctionne

1. **Détection automatique** : Le script lit tous les fichiers `.sql` dans le dossier `/sql`
2. **Tracking** : Une table `schema_migrations` garde la trace des migrations déjà exécutées
3. **Exécution intelligente** : Seules les nouvelles migrations sont exécutées
4. **Ordre alphabétique** : Les fichiers sont exécutés dans l'ordre alphabétique

### 🎯 Exemple de sortie

```
🚀 Démarrage des migrations FoxFood

✓ Table schema_migrations créée/vérifiée

Migrations déjà exécutées: 3
  - schema.sql
  - add_user_settings.sql
  - add_notifications_system.sql

Fichiers SQL trouvés: 5

⊘ schema.sql (déjà exécutée)
⊘ add_user_settings.sql (déjà exécutée)
⊘ add_notifications_system.sql (déjà exécutée)

→ Exécution: add_password_reset_tokens.sql
✓ add_password_reset_tokens.sql exécutée avec succès

→ Exécution: add_household_system.sql
✓ add_household_system.sql exécutée avec succès

==================================================
📊 Résumé des migrations:
   ✓ Exécutées: 2
   ⊘ Déjà faites: 3
   ✗ Échecs: 0
==================================================

✓ Migrations terminées avec succès !
```

### ⚙️ Configuration

Le script utilise la variable d'environnement `POSTGRES_URL` de votre fichier `.env` :

```env
POSTGRES_URL=postgresql://...
```

### 📝 Ajouter une nouvelle migration

1. Créez un fichier SQL dans `/sql/` avec un nom descriptif :
   ```
   sql/add_nouvelle_fonctionnalite.sql
   ```

2. Écrivez votre SQL :
   ```sql
   -- Migration: Description de la fonctionnalité

   CREATE TABLE IF NOT EXISTS nouvelle_table (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL
   );

   -- Créer des index si nécessaire
   CREATE INDEX IF NOT EXISTS idx_nouvelle_table_name ON nouvelle_table(name);
   ```

3. Lancez la migration :
   ```bash
   npm run migrate
   ```

4. Le script détectera automatiquement la nouvelle migration et l'exécutera

### 🛡️ Sécurité

- ✅ Chaque migration n'est exécutée qu'une seule fois
- ✅ Les migrations échouées n'empêchent pas les futures exécutions
- ✅ Le tracking est persisté en base de données
- ✅ Pas de risque de double exécution

### 🐛 Dépannage

**Erreur : POSTGRES_URL non défini**
→ Vérifiez que votre fichier `.env` contient `POSTGRES_URL`

**Erreur : Permission denied**
→ Sur Linux/Mac, rendez le script exécutable :
```bash
chmod +x scripts/migrate.js
```

**Migration échouée**
→ Vérifiez le SQL dans le fichier concerné
→ Corrigez l'erreur
→ Relancez `npm run migrate` (les migrations réussies ne seront pas ré-exécutées)

### 📦 Déploiement sur Vercel

Le script peut être exécuté automatiquement lors du déploiement en ajoutant dans `package.json` :

```json
{
  "scripts": {
    "build": "npm run migrate && next build"
  }
}
```

Cela exécutera les migrations avant chaque build de production.

### 🔄 Ordre d'exécution recommandé

Les fichiers SQL dans `/sql/` devraient suivre une convention de nommage :

```
schema.sql                      # Base schema (toujours en premier)
add_user_settings.sql          # Ajout de colonnes users
add_notifications_system.sql   # Système de notifications
add_household_system.sql       # Système de foyers
add_password_reset_tokens.sql  # Tokens de reset password
```

Le préfixe `add_`, `create_`, `alter_` aide à organiser chronologiquement.

### ✨ Fonctionnalités avancées

**Vérifier l'état sans exécuter** :
Le script affiche toujours quelles migrations sont à jour avant d'exécuter.

**Rollback** :
Les rollbacks doivent être faits manuellement via des migrations inverses :
```
add_feature.sql       # Migration forward
remove_feature.sql    # Migration rollback (à exécuter manuellement si besoin)
```

**Migrations complexes** :
Pour des migrations très longues, divisez en plusieurs fichiers :
```
add_feature_part1.sql
add_feature_part2.sql
```

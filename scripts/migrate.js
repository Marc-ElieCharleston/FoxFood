#!/usr/bin/env node

/**
 * Script de migration automatique pour FoxFood
 * Exécute toutes les migrations SQL dans le dossier sql/
 *
 * Usage: npm run migrate
 */

const { sql } = require('@vercel/postgres')
const fs = require('fs')
const path = require('path')

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function createMigrationsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
    log('✓ Table schema_migrations créée/vérifiée', 'green')
  } catch (error) {
    log(`✗ Erreur création table migrations: ${error.message}`, 'red')
    throw error
  }
}

async function getExecutedMigrations() {
  try {
    const result = await sql`SELECT migration_name FROM schema_migrations ORDER BY id`
    return result.rows.map(row => row.migration_name)
  } catch (error) {
    log(`✗ Erreur lecture migrations: ${error.message}`, 'red')
    return []
  }
}

async function markMigrationAsExecuted(migrationName) {
  try {
    await sql`
      INSERT INTO schema_migrations (migration_name)
      VALUES (${migrationName})
      ON CONFLICT (migration_name) DO NOTHING
    `
  } catch (error) {
    log(`✗ Erreur enregistrement migration: ${error.message}`, 'red')
  }
}

async function executeMigration(filePath, fileName) {
  try {
    log(`\n→ Exécution: ${fileName}`, 'cyan')

    // Lire le fichier SQL
    const sqlContent = fs.readFileSync(filePath, 'utf8')

    // Séparer les commandes SQL (séparées par des lignes vides ou des commentaires)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))

    // Exécuter chaque commande
    for (const command of commands) {
      if (command.trim()) {
        await sql.query(command + ';')
      }
    }

    // Marquer comme exécutée
    await markMigrationAsExecuted(fileName)

    log(`✓ ${fileName} exécutée avec succès`, 'green')
    return true
  } catch (error) {
    log(`✗ Erreur dans ${fileName}: ${error.message}`, 'red')
    return false
  }
}

async function runMigrations() {
  log('\n🚀 Démarrage des migrations FoxFood\n', 'blue')

  try {
    // Vérifier la connexion DB
    if (!process.env.POSTGRES_URL) {
      log('✗ POSTGRES_URL non défini dans .env', 'red')
      process.exit(1)
    }

    // Créer la table de tracking
    await createMigrationsTable()

    // Récupérer les migrations déjà exécutées
    const executedMigrations = await getExecutedMigrations()
    log(`\nMigrations déjà exécutées: ${executedMigrations.length}`, 'yellow')
    if (executedMigrations.length > 0) {
      executedMigrations.forEach(name => log(`  - ${name}`, 'yellow'))
    }

    // Lister tous les fichiers SQL
    const sqlDir = path.join(__dirname, '..', 'sql')
    const sqlFiles = fs.readdirSync(sqlDir)
      .filter(file => file.endsWith('.sql'))
      .sort() // Ordre alphabétique

    log(`\nFichiers SQL trouvés: ${sqlFiles.length}`, 'cyan')

    // Exécuter les migrations non encore exécutées
    let executed = 0
    let skipped = 0
    let failed = 0

    for (const file of sqlFiles) {
      if (executedMigrations.includes(file)) {
        log(`⊘ ${file} (déjà exécutée)`, 'yellow')
        skipped++
      } else {
        const filePath = path.join(sqlDir, file)
        const success = await executeMigration(filePath, file)
        if (success) {
          executed++
        } else {
          failed++
        }
      }
    }

    // Résumé
    log('\n' + '='.repeat(50), 'blue')
    log('📊 Résumé des migrations:', 'blue')
    log(`   ✓ Exécutées: ${executed}`, executed > 0 ? 'green' : 'reset')
    log(`   ⊘ Déjà faites: ${skipped}`, 'yellow')
    log(`   ✗ Échecs: ${failed}`, failed > 0 ? 'red' : 'reset')
    log('='.repeat(50) + '\n', 'blue')

    if (failed > 0) {
      log('⚠️  Certaines migrations ont échoué. Vérifiez les erreurs ci-dessus.', 'red')
      process.exit(1)
    } else if (executed === 0 && skipped === sqlFiles.length) {
      log('✓ Toutes les migrations sont à jour !', 'green')
    } else {
      log('✓ Migrations terminées avec succès !', 'green')
    }

  } catch (error) {
    log(`\n✗ Erreur fatale: ${error.message}`, 'red')
    console.error(error)
    process.exit(1)
  }
}

// Exécuter les migrations
runMigrations()

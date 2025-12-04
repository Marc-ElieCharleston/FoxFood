// Script pour executer les migrations SQL sur Neon
// Usage: node run-migration.js [fichier.sql]

require('dotenv').config()
const { sql } = require('@vercel/postgres')
const fs = require('fs')
const path = require('path')

async function runMigration() {
  const sqlFile = process.argv[2]

  if (!sqlFile) {
    console.log('Usage: node run-migration.js <fichier.sql>')
    console.log('Exemple: node run-migration.js sql/add_ingredients_system.sql')
    process.exit(1)
  }

  const filePath = path.resolve(sqlFile)

  if (!fs.existsSync(filePath)) {
    console.error(`Fichier non trouve: ${filePath}`)
    process.exit(1)
  }

  const sqlContent = fs.readFileSync(filePath, 'utf-8')

  console.log(`Execution de: ${sqlFile}`)
  console.log('---')

  // Separer les commandes de manière intelligente
  // On garde les blocs DO $$ ensemble et on gère les strings avec apostrophes
  const commands = []
  let current = ''
  let inDollarQuote = false
  let inString = false

  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i]
    const next = sqlContent[i + 1]

    // Détecter les blocs $$
    if (char === '$' && next === '$') {
      inDollarQuote = !inDollarQuote
      current += char
      continue
    }

    // Détecter les strings avec apostrophes (mais pas les apostrophes échappées '')
    if (char === "'" && !inDollarQuote) {
      if (next === "'") {
        current += char + next
        i++
        continue
      }
      inString = !inString
    }

    // Fin de commande si ; et pas dans un bloc spécial
    if (char === ';' && !inDollarQuote && !inString) {
      current += char
      const trimmed = current.trim()
      // Ignorer les lignes de commentaires seuls
      if (trimmed && !trimmed.startsWith('--')) {
        // Retirer les commentaires en début
        const withoutComments = trimmed.split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim()
        if (withoutComments) {
          commands.push(withoutComments)
        }
      }
      current = ''
    } else {
      current += char
    }
  }

  try {
    let successCount = 0
    for (const command of commands) {
      if (command.length > 0) {
        const preview = command.substring(0, 60).replace(/\n/g, ' ')
        console.log(`Execution: ${preview}...`)
        try {
          await sql.query(command)
          console.log('  OK')
          successCount++
        } catch (err) {
          // Si c'est une erreur "already exists", on continue
          if (err.message.includes('already exists') ||
              err.message.includes('duplicate key') ||
              err.message.includes('does not exist')) {
            console.log(`  SKIP: ${err.message.substring(0, 50)}`)
            successCount++
          } else {
            throw err
          }
        }
      }
    }
    console.log('---')
    console.log(`Migration terminee! ${successCount}/${commands.length} commandes executees`)
  } catch (error) {
    console.error('Erreur:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

runMigration()

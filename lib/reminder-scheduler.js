import { sql } from './db'
import { sendUserReminder, notifyAdminMissingSelection } from './notifications'

/**
 * Logique de planification des rappels automatiques
 */

/**
 * Convertir un jour de la semaine en français vers un numéro (1=Lundi, 7=Dimanche)
 */
function getDayNumber(dayName) {
  const days = {
    'Lundi': 1,
    'Mardi': 2,
    'Mercredi': 3,
    'Jeudi': 4,
    'Vendredi': 5,
    'Samedi': 6,
    'Dimanche': 7
  }
  return days[dayName] || 0
}

/**
 * Calculer le nombre de jours jusqu'au prochain jour donné
 */
function daysUntilNextDay(targetDayNumber) {
  const today = new Date()
  const currentDay = today.getDay() // 0=Dimanche, 1=Lundi, ..., 6=Samedi

  // Convertir au format 1-7 (1=Lundi, 7=Dimanche)
  const currentDayNumber = currentDay === 0 ? 7 : currentDay

  // Calculer la différence
  let diff = targetDayNumber - currentDayNumber
  if (diff <= 0) {
    diff += 7 // Si le jour est passé cette semaine, prendre la semaine prochaine
  }

  return diff
}

/**
 * Récupérer tous les utilisateurs avec leurs paramètres de rappels
 */
export async function getUsersWithReminders() {
  const users = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.delivery_day,
      u.delivery_time_slot,
      u.notification_email,
      u.notification_phone,
      u.settings_completed
    FROM users u
    WHERE u.role = 'user'
    AND u.settings_completed = true
    AND u.delivery_day IS NOT NULL
  `

  return users.rows
}

/**
 * Récupérer les rappels configurés pour un utilisateur
 */
export async function getUserReminders(userId) {
  const reminders = await sql`
    SELECT days_before, enabled, send_email, send_sms
    FROM user_reminders
    WHERE user_id = ${userId}
    AND enabled = true
    ORDER BY days_before DESC
  `

  return reminders.rows
}

/**
 * Vérifier si un utilisateur a déjà une sélection cette semaine
 */
export async function hasUserMadeSelection(userId) {
  // On considère qu'une sélection est valide si elle a été faite récemment
  // (dans les 7 derniers jours)
  const result = await sql`
    SELECT id
    FROM user_selections
    WHERE user_id = ${userId}
    AND created_at > NOW() - INTERVAL '7 days'
    LIMIT 1
  `

  return result.rows.length > 0
}

/**
 * Récupérer les paramètres admin
 */
export async function getAdminSettings() {
  const settings = await sql`
    SELECT
      a.notification_email,
      a.notification_phone,
      a.send_email,
      a.send_sms,
      a.notify_on_missing_selection,
      a.auto_reminder_days_before,
      u.email as user_email
    FROM admin_settings a
    JOIN users u ON a.user_id = u.id
    WHERE u.role = 'admin'
    LIMIT 1
  `

  return settings.rows[0] || null
}

/**
 * Traiter les rappels pour tous les utilisateurs
 * À appeler quotidiennement par un cron job
 */
export async function processReminders() {
  const results = {
    processed: 0,
    reminders_sent: 0,
    admin_alerts: 0,
    errors: []
  }

  try {
    // Récupérer tous les utilisateurs
    const users = await getUsersWithReminders()
    const adminSettings = await getAdminSettings()

    for (const user of users) {
      try {
        results.processed++

        // Calculer le nombre de jours jusqu'au prochain passage
        const dayNumber = getDayNumber(user.delivery_day)
        const daysUntilDelivery = daysUntilNextDay(dayNumber)

        // Vérifier si l'utilisateur a fait sa sélection
        const hasSelection = await hasUserMadeSelection(user.id)

        // Récupérer les rappels configurés pour cet utilisateur
        const reminders = await getUserReminders(user.id)

        // Pour chaque rappel configuré, vérifier s'il faut l'envoyer aujourd'hui
        for (const reminder of reminders) {
          if (reminder.days_before === daysUntilDelivery && !hasSelection) {
            // Envoyer le rappel à l'utilisateur
            const reminderResult = await sendUserReminder({
              userId: user.id,
              userName: user.name,
              userEmail: user.notification_email || user.email,
              userPhone: user.notification_phone,
              daysBeforeDelivery: daysUntilDelivery,
              sendEmail: reminder.send_email,
              sendSMS: reminder.send_sms
            })

            if (reminderResult.success) {
              results.reminders_sent++
            } else {
              results.errors.push(`Échec rappel user ${user.id}`)
            }
          }
        }

        // Vérifier si l'admin doit être notifié (sélection manquante)
        if (
          !hasSelection &&
          adminSettings &&
          adminSettings.notify_on_missing_selection &&
          adminSettings.auto_reminder_days_before === daysUntilDelivery
        ) {
          const alertResult = await notifyAdminMissingSelection({
            adminEmail: adminSettings.notification_email || adminSettings.user_email,
            adminPhone: adminSettings.notification_phone,
            sendEmail: adminSettings.send_email,
            sendSMS: adminSettings.send_sms,
            userName: user.name,
            userEmail: user.email,
            daysLeft: daysUntilDelivery
          })

          if (alertResult.success) {
            results.admin_alerts++
          } else {
            results.errors.push(`Échec alerte admin pour user ${user.id}`)
          }
        }
      } catch (error) {
        console.error(`Erreur traitement user ${user.id}:`, error)
        results.errors.push(`Erreur user ${user.id}: ${error.message}`)
      }
    }
  } catch (error) {
    console.error('Erreur globale processReminders:', error)
    results.errors.push(`Erreur globale: ${error.message}`)
  }

  return results
}

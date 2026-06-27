import { sql } from './db'
import { sendUserReminder, sendWeeklyShoppingReminder, notifyAdminMissingSelection } from './notifications'

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
 * Exclut les utilisateurs inactifs (active = false)
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
      u.notification_phone_secondary,
      u.settings_completed,
      u.active
    FROM users u
    WHERE u.role = 'client'
    AND u.settings_completed = true
    AND u.delivery_day IS NOT NULL
    AND (u.active IS NULL OR u.active = true)
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
 * Récupérer la sélection d'un utilisateur pour une semaine spécifique
 */
export async function getUserWeekSelection(userId, weekStartDate) {
  const result = await sql`
    SELECT
      ws.id,
      ws.week_start_date,
      ws.selected_dishes,
      u.household_size
    FROM weekly_selections ws
    JOIN users u ON ws.user_id = u.id
    WHERE ws.user_id = ${userId}
    AND ws.week_start_date = ${weekStartDate}
    AND ws.selected_dishes IS NOT NULL
    AND jsonb_array_length(ws.selected_dishes) > 0
    LIMIT 1
  `

  return result.rows[0] || null
}

/**
 * Calculer la date du lundi de la semaine où tombe un jour donné
 */
function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
  return new Date(d.setDate(diff))
}

/**
 * Calculer la date de début de semaine pour le prochain passage
 */
function getNextWeekStartDate(daysUntilDelivery) {
  const today = new Date()
  const deliveryDate = new Date(today)
  deliveryDate.setDate(today.getDate() + daysUntilDelivery)

  // Retourner le lundi de cette semaine
  const monday = getMondayOfWeek(deliveryDate)
  return monday.toISOString().split('T')[0]
}

/**
 * Récupérer les paramètres admin
 */
export async function getAdminSettings() {
  // Il peut exister plusieurs comptes admin (chef réel + comptes de test/dev).
  // On cible de façon DÉTERMINISTE le compte du chef (configurable via env),
  // avec repli sur le plus petit user_id admin. Évite le LIMIT 1 aléatoire qui
  // faisait varier le destinataire et le seuil de rappel d'une exécution à l'autre.
  const primaryEmail = process.env.ADMIN_PRIMARY_EMAIL || 'foxfood.chef@gmail.com'
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
    ORDER BY (a.notification_email = ${primaryEmail}) DESC, a.user_id ASC
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

        // Calculer la date de début de semaine concernée
        const weekStartDate = getNextWeekStartDate(daysUntilDelivery)

        // Récupérer la sélection de l'utilisateur pour cette semaine
        const weekSelection = await getUserWeekSelection(user.id, weekStartDate)

        // Récupérer les rappels configurés pour cet utilisateur
        const reminders = await getUserReminders(user.id)

        // Pour chaque rappel configuré, vérifier s'il faut l'envoyer aujourd'hui
        for (const reminder of reminders) {
          if (reminder.days_before === daysUntilDelivery) {
            if (!weekSelection) {
              // Pas de sélection -> rappel simple pour choisir
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
            } else {
              // Sélection existante -> rappel avec plats et liste de courses
              if (reminder.send_email) {
                const shoppingReminderResult = await sendWeeklyShoppingReminder({
                  userId: user.id,
                  userName: user.name,
                  userEmail: user.notification_email || user.email,
                  householdSize: weekSelection.household_size || 1,
                  weekStartDate: weekSelection.week_start_date,
                  selectedDishes: weekSelection.selected_dishes,
                  daysBeforeDelivery: daysUntilDelivery
                })

                if (shoppingReminderResult.success) {
                  results.reminders_sent++
                } else {
                  results.errors.push(`Échec rappel courses user ${user.id}`)
                }
              }
            }
          }
        }

        // Vérifier si l'admin doit être notifié (sélection manquante)
        if (
          !weekSelection &&
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

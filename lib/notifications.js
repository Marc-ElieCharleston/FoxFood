import { sql } from './db'

/**
 * Service de notifications pour FoxFood
 * Gère l'envoi d'emails et de SMS
 */

// Configuration Resend pour les emails
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@foxfood.com'

/**
 * Envoyer un email via Resend
 */
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY non configurée, email simulé')
    return { success: true, simulated: true }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Erreur Resend: ${error}`)
    }

    const data = await response.json()
    return { success: true, id: data.id }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Envoyer un SMS via OVH
 */
async function sendSMS({ to, message }) {
  const APP_KEY = process.env.OVH_APP_KEY
  const APP_SECRET = process.env.OVH_APP_SECRET
  const CONSUMER_KEY = process.env.OVH_CONSUMER_KEY
  const SMS_SERVICE = process.env.OVH_SMS_SERVICE

  if (!APP_KEY || !APP_SECRET || !CONSUMER_KEY || !SMS_SERVICE) {
    console.warn('OVH SMS non configuré, SMS simulé')
    console.log(`SMS simulé vers ${to}: ${message}`)
    return { success: true, simulated: true }
  }

  try {
    const crypto = require('crypto')
    const timestamp = Math.floor(Date.now() / 1000)
    const method = 'POST'
    const url = `https://eu.api.ovh.com/1.0/sms/${SMS_SERVICE}/jobs`

    // Formater le numéro (s'assurer qu'il commence par +33 ou 0033)
    let formattedNumber = to.replace(/\s/g, '')
    if (formattedNumber.startsWith('0')) {
      formattedNumber = '+33' + formattedNumber.slice(1)
    } else if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+' + formattedNumber
    }

    const body = JSON.stringify({
      charset: 'UTF-8',
      class: 'phoneDisplay',
      coding: '7bit',
      message: message,
      noStopClause: true,
      priority: 'high',
      receivers: [formattedNumber],
      senderForResponse: true,
      validityPeriod: 2880
    })

    const signature = '$1$' + crypto
      .createHash('sha1')
      .update([APP_SECRET, CONSUMER_KEY, method, url, body, timestamp].join('+'))
      .digest('hex')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ovh-Application': APP_KEY,
        'X-Ovh-Consumer': CONSUMER_KEY,
        'X-Ovh-Timestamp': timestamp.toString(),
        'X-Ovh-Signature': signature
      },
      body: body
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`Erreur OVH: ${JSON.stringify(data)}`)
    }

    console.log(`SMS envoyé à ${formattedNumber}:`, data)
    return { success: true, ids: data.ids, credits: data.totalCreditsRemoved }
  } catch (error) {
    console.error('Erreur lors de l\'envoi du SMS:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Logger une notification dans la base de données
 */
async function logNotification({
  notification_type,
  recipient_user_id,
  recipient_email,
  recipient_phone,
  method,
  subject,
  content,
  status,
  error_message
}) {
  try {
    await sql`
      INSERT INTO notifications_log (
        notification_type,
        recipient_user_id,
        recipient_email,
        recipient_phone,
        method,
        subject,
        content,
        status,
        error_message
      )
      VALUES (
        ${notification_type},
        ${recipient_user_id || null},
        ${recipient_email || null},
        ${recipient_phone || null},
        ${method},
        ${subject || null},
        ${content},
        ${status},
        ${error_message || null}
      )
    `
  } catch (error) {
    console.error('Erreur lors du log de notification:', error)
  }
}

/**
 * Envoyer une notification utilisateur (rappel de sélection)
 */
export async function sendUserReminder({ userId, userName, userEmail, userPhone, userPhoneSecondary, daysBeforeDelivery, sendEmail: doEmail, sendSMS: doSMS }) {
  const subject = `Rappel: Sélectionnez vos plats - ${daysBeforeDelivery} jour${daysBeforeDelivery > 1 ? 's' : ''} restant${daysBeforeDelivery > 1 ? 's' : ''}`

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Bonjour ${userName} 👋</h2>
      <p>Emeric passe dans <strong>${daysBeforeDelivery} jour${daysBeforeDelivery > 1 ? 's' : ''}</strong> !</p>
      <p>N'oubliez pas de sélectionner vos plats pour cette semaine.</p>
      <p style="margin: 30px 0;">
        <a href="${process.env.NEXTAUTH_URL}"
           style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Choisir mes plats
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        À bientôt,<br/>
        L'équipe FoxFood
      </p>
    </div>
  `

  const smsContent = `FoxFood: Bonjour ${userName}, Emeric passe dans ${daysBeforeDelivery} jour(s). N'oubliez pas de selectionner vos plats !`

  let emailResult = { success: true }
  let smsResult = { success: true }

  if (doEmail && userEmail) {
    emailResult = await sendEmail({
      to: userEmail,
      subject,
      html: emailContent
    })
  }

  if (doSMS && userPhone) {
    // Envoyer au numéro principal
    smsResult = await sendSMS({
      to: userPhone,
      message: smsContent
    })

    // Envoyer au numéro secondaire si renseigné
    if (userPhoneSecondary) {
      await sendSMS({
        to: userPhoneSecondary,
        message: smsContent
      })
    }
  }

  // Logger la notification
  const method = (doEmail && doSMS) ? 'both' : (doEmail ? 'email' : 'sms')
  await logNotification({
    notification_type: 'user_reminder',
    recipient_user_id: userId,
    recipient_email: userEmail,
    recipient_phone: userPhone,
    method,
    subject,
    content: emailContent,
    status: (emailResult.success && smsResult.success) ? 'sent' : 'failed',
    error_message: (!emailResult.success ? emailResult.error : null) || (!smsResult.success ? smsResult.error : null)
  })

  return {
    success: emailResult.success && smsResult.success,
    emailResult,
    smsResult
  }
}

/**
 * Envoyer un rappel de courses pour une semaine spécifique (avec plats et liste de courses)
 */
export async function sendWeeklyShoppingReminder({
  userId,
  userName,
  userEmail,
  householdSize,
  weekStartDate,
  selectedDishes,
  daysBeforeDelivery
}) {
  if (!userEmail || !selectedDishes || selectedDishes.length === 0) {
    return { success: false, error: 'Données manquantes' }
  }

  try {
    // Récupérer les noms des plats
    const dishesResult = await sql`
      SELECT d.id, d.name FROM dishes d
      WHERE d.id = ANY(${selectedDishes})
    `

    const dishNames = dishesResult.rows.map(d => d.name)

    // Générer la liste de courses
    const shoppingData = await getShoppingListData({
      selectedDishes,
      householdSize
    })

    let shoppingListHtml = ''
    if (shoppingData) {
      shoppingListHtml = generateShoppingListHtml(shoppingData)
    }

    // Formater la date
    const weekDate = new Date(weekStartDate)
    const formattedDate = weekDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })

    const subject = `🛒 Rappel courses - Semaine du ${formattedDate}`

    const dishList = dishNames.map(d => `<li>${d}</li>`).join('')

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bonjour ${userName} ! 👋</h2>
        <p>Votre livraison arrive dans <strong>${daysBeforeDelivery} jour${daysBeforeDelivery > 1 ? 's' : ''}</strong> !</p>
        <p>N'oubliez pas de faire vos courses si ce n'est pas encore fait. 🛒</p>

        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
          <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 16px;">📅 Semaine du ${formattedDate}</h3>

          <div style="margin-bottom: 15px;">
            <strong style="color: #6b7280; font-size: 14px;">Vos plats :</strong>
            <ul style="margin: 5px 0; padding-left: 20px; line-height: 1.6;">
              ${dishList}
            </ul>
          </div>

          ${shoppingListHtml ? `
            <div style="background-color: #fff7ed; padding: 15px; border-radius: 8px; margin-top: 15px;">
              <h4 style="margin: 0 0 10px 0; color: #ea580c; font-size: 14px;">🛒 Liste de courses</h4>
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 10px 0;">Pour ${householdSize} personne${householdSize > 1 ? 's' : ''}</p>
              ${shoppingListHtml}
            </div>
          ` : ''}
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Bon appétit ! 🍽️<br/>
          L'équipe FoxFood
        </p>
      </div>
    `

    const emailResult = await sendEmail({
      to: userEmail,
      subject,
      html: emailContent
    })

    await logNotification({
      notification_type: 'weekly_shopping_reminder',
      recipient_user_id: userId,
      recipient_email: userEmail,
      method: 'email',
      subject,
      content: `Rappel courses: ${dishNames.length} plats`,
      status: emailResult.success ? 'sent' : 'failed',
      error_message: emailResult.error || null
    })

    return emailResult
  } catch (error) {
    console.error('Erreur envoi rappel courses:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Notifier l'admin qu'un client a fait sa sélection (séparé par semaine)
 */
export async function notifyAdminOnSelection({ adminEmail, adminPhone, sendEmail: doEmail, sendSMS: doSMS, userName, userEmail, weeklyData, householdSize }) {
  const subject = `${userName} a fait sa sélection`

  // Construire le HTML par semaine
  let weeksHtml = ''
  let totalDishes = 0

  for (const [weekKey, weekInfo] of Object.entries(weeklyData)) {
    if (!weekInfo || !weekInfo.dishes || weekInfo.dishes.length === 0) continue

    const weekDate = new Date(weekInfo.date)
    const formattedDate = weekDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })

    const dishList = weekInfo.dishes.map(d => `<li>${d}</li>`).join('')
    totalDishes += weekInfo.dishes.length

    // Liste de courses pour cette semaine
    let shoppingHtml = ''
    if (weekInfo.shoppingListHtml) {
      shoppingHtml = `
        <div style="background-color: #fff7ed; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <h4 style="margin: 0 0 10px 0; color: #ea580c; font-size: 14px;">🛒 Liste de courses</h4>
          ${weekInfo.shoppingListHtml}
        </div>
      `
    }

    weeksHtml += `
      <div style="margin-bottom: 30px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #ea580c;">
        <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 16px;">📅 Semaine du ${formattedDate}</h3>
        <div style="margin-bottom: 10px;">
          <strong style="color: #6b7280; font-size: 14px;">Plats sélectionnés :</strong>
          <ul style="margin: 5px 0; padding-left: 20px; line-height: 1.6;">
            ${dishList}
          </ul>
        </div>
        ${shoppingHtml}
      </div>
    `
  }

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Nouvelle sélection 🎉</h2>
      <p><strong>${userName}</strong> (${userEmail}) a sélectionné <strong>${totalDishes} plat${totalDishes > 1 ? 's' : ''}</strong></p>
      <p style="color: #6b7280; font-size: 14px;">Quantités pour <strong>${householdSize} personne${householdSize > 1 ? 's' : ''}</strong></p>

      ${weeksHtml}

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        FoxFood - Notifications admin
      </p>
    </div>
  `

  const smsContent = `${userName} a fait sa sélection de ${totalDishes} plat(s).`

  let emailResult = { success: true }
  let smsResult = { success: true }

  if (doEmail && adminEmail) {
    emailResult = await sendEmail({
      to: adminEmail,
      subject,
      html: emailContent
    })
  }

  if (doSMS && adminPhone) {
    smsResult = await sendSMS({
      to: adminPhone,
      message: smsContent
    })
  }

  const method = (doEmail && doSMS) ? 'both' : (doEmail ? 'email' : 'sms')
  await logNotification({
    notification_type: 'admin_selection_notification',
    recipient_email: adminEmail,
    recipient_phone: adminPhone,
    method,
    subject,
    content: emailContent,
    status: (emailResult.success && smsResult.success) ? 'sent' : 'failed',
    error_message: (!emailResult.success ? emailResult.error : null) || (!smsResult.success ? smsResult.error : null)
  })

  return {
    success: emailResult.success && smsResult.success,
    emailResult,
    smsResult
  }
}

/**
 * Notifier l'admin qu'un client n'a pas fait sa sélection
 */
export async function notifyAdminMissingSelection({ adminEmail, adminPhone, sendEmail: doEmail, sendSMS: doSMS, userName, userEmail, daysLeft }) {
  const subject = `${userName} n'a pas encore fait sa sélection`

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Sélection manquante ⚠️</h2>
      <p><strong>${userName}</strong> (${userEmail}) n'a pas encore sélectionné ses plats.</p>
      <p>Son passage est prévu dans <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.</p>
      <p style="color: #666; font-size: 14px;">
        FoxFood - Notifications admin
      </p>
    </div>
  `

  const smsContent = `${userName} n'a pas encore fait sa sélection. Passage dans ${daysLeft} jour(s).`

  let emailResult = { success: true }
  let smsResult = { success: true }

  if (doEmail && adminEmail) {
    emailResult = await sendEmail({
      to: adminEmail,
      subject,
      html: emailContent
    })
  }

  if (doSMS && adminPhone) {
    smsResult = await sendSMS({
      to: adminPhone,
      message: smsContent
    })
  }

  const method = (doEmail && doSMS) ? 'both' : (doEmail ? 'email' : 'sms')
  await logNotification({
    notification_type: 'admin_missing_selection',
    recipient_email: adminEmail,
    recipient_phone: adminPhone,
    method,
    subject,
    content: emailContent,
    status: (emailResult.success && smsResult.success) ? 'sent' : 'failed',
    error_message: (!emailResult.success ? emailResult.error : null) || (!smsResult.success ? smsResult.error : null)
  })

  return {
    success: emailResult.success && smsResult.success,
    emailResult,
    smsResult
  }
}

/**
 * Notifier l'admin d'une demande de plat personnalisé
 */
export async function notifyAdminCustomDish({ adminEmail, adminPhone, sendEmail: doEmail, sendSMS: doSMS, userName, userEmail, dishName, description, isDetailed, ingredients }) {
  const subject = `✨ Nouveau plat personnalisé ajouté: ${dishName}`

  const ingredientsList = isDetailed && ingredients?.length > 0
    ? `<p><strong>Ingrédients suggérés :</strong></p><ul>${ingredients.map(i => `<li>${i}</li>`).join('')}</ul>`
    : ''

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">✅ Nouveau plat personnalisé ajouté</h2>
      <p><strong>${userName}</strong> (${userEmail}) a créé un plat personnalisé :</p>
      <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
        <p><strong>Plat :</strong> ${dishName}</p>
        <p><strong>Description :</strong> ${description}</p>
        <p><strong>Type :</strong> ${isDetailed ? 'Demande détaillée avec ingrédients' : 'Demande simple'}</p>
        ${ingredientsList}
      </div>
      <div style="background-color: #fef3c7; padding: 12px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px;">
          ℹ️ <strong>Le plat a été automatiquement validé et ajouté au catalogue.</strong><br>
          Si vous souhaitez le refuser, rendez-vous dans l'admin pour le désactiver.
        </p>
      </div>
      <p style="color: #666; font-size: 14px;">
        FoxFood - Notifications admin
      </p>
    </div>
  `

  const smsContent = `Nouveau plat personnalisé: ${dishName} par ${userName} (validé automatiquement)`

  let emailResult = { success: true }
  let smsResult = { success: true }

  if (doEmail && adminEmail) {
    emailResult = await sendEmail({
      to: adminEmail,
      subject,
      html: emailContent
    })
  }

  if (doSMS && adminPhone) {
    smsResult = await sendSMS({
      to: adminPhone,
      message: smsContent
    })
  }

  const method = (doEmail && doSMS) ? 'both' : (doEmail ? 'email' : 'sms')
  await logNotification({
    notification_type: 'admin_custom_dish',
    recipient_email: adminEmail,
    recipient_phone: adminPhone,
    method,
    subject,
    content: emailContent,
    status: (emailResult.success && smsResult.success) ? 'sent' : 'failed',
    error_message: (!emailResult.success ? emailResult.error : null) || (!smsResult.success ? smsResult.error : null)
  })

  return {
    success: emailResult.success && smsResult.success,
    emailResult,
    smsResult
  }
}

/**
 * Notifier le client de la réponse à sa demande de plat personnalisé
 */
export async function notifyUserCustomDishResponse({
  userId,
  userName,
  userEmail,
  userPhone,
  dishName,
  status,
  adminNotes
}) {
  const isApproved = status === 'approved'
  const subject = isApproved
    ? `Bonne nouvelle ! Votre demande "${dishName}" a été approuvée`
    : `Réponse à votre demande "${dishName}"`

  const statusLabel = isApproved ? 'approuvée' : 'refusée'
  const statusColor = isApproved ? '#22c55e' : '#ef4444'
  const statusEmoji = isApproved ? '✅' : '❌'

  const notesSection = adminNotes
    ? `
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #374151;">Message d'Emeric :</p>
        <p style="margin: 0; color: #4b5563;">${adminNotes}</p>
      </div>
    `
    : ''

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Bonjour ${userName} 👋</h2>
      <p>Votre demande de plat personnalisé a reçu une réponse :</p>
      <div style="border-left: 4px solid ${statusColor}; padding-left: 15px; margin: 20px 0;">
        <p style="font-size: 18px; margin: 0;">
          <strong>${dishName}</strong>
        </p>
        <p style="color: ${statusColor}; font-weight: bold; margin: 5px 0 0 0;">
          ${statusEmoji} Demande ${statusLabel}
        </p>
      </div>
      ${notesSection}
      ${isApproved ? `
        <p>Vous pouvez maintenant sélectionner ce plat dans votre prochaine commande !</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}"
             style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Voir les plats
          </a>
        </p>
      ` : ''}
      <p style="color: #666; font-size: 14px;">
        À bientôt,<br/>
        L'équipe FoxFood
      </p>
    </div>
  `

  const smsContent = isApproved
    ? `FoxFood: ${statusEmoji} Votre demande "${dishName}" a été approuvée! ${adminNotes ? `Message: ${adminNotes}` : ''}`
    : `FoxFood: ${statusEmoji} Votre demande "${dishName}" a été refusée. ${adminNotes ? `Raison: ${adminNotes}` : ''}`

  let emailResult = { success: true }
  let smsResult = { success: true }

  if (userEmail) {
    emailResult = await sendEmail({
      to: userEmail,
      subject,
      html: emailContent
    })
  }

  if (userPhone) {
    smsResult = await sendSMS({
      to: userPhone,
      message: smsContent
    })
  }

  // Logger la notification
  await logNotification({
    notification_type: 'custom_dish_response',
    recipient_user_id: userId,
    recipient_email: userEmail,
    recipient_phone: userPhone,
    method: userEmail && userPhone ? 'both' : (userEmail ? 'email' : 'sms'),
    subject,
    content: emailContent,
    status: (emailResult.success && smsResult.success) ? 'sent' : 'failed',
    error_message: (!emailResult.success ? emailResult.error : null) || (!smsResult.success ? smsResult.error : null)
  })

  return {
    success: emailResult.success && smsResult.success,
    emailResult,
    smsResult
  }
}

/**
 * Envoyer un email de bienvenue à un nouvel utilisateur
 */
export async function sendWelcomeEmail({ userId, userName, userEmail }) {
  const subject = `Bienvenue chez FoxFood ! 🍽️`

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Bienvenue ${userName} ! 👋</h2>
      <p>Merci d'avoir rejoint <strong>FoxFood</strong> !</p>
      <p>Votre compte est maintenant configuré et prêt à l'emploi.</p>

      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <h3 style="margin-top: 0; color: #ea580c;">Comment ça marche ?</h3>
        <ul style="line-height: 1.8; color: #374151;">
          <li><strong>Choisissez vos plats</strong> parmi le catalogue d'Emeric (jusqu'à 5 plats par semaine)</li>
          <li><strong>Validez votre sélection</strong> avant la date de passage</li>
          <li><strong>Recevez vos rappels</strong> automatiques par email/SMS</li>
          <li><strong>Profitez</strong> de vos plats préparés avec amour !</li>
        </ul>
      </div>

      <p>Vous pouvez dès maintenant commencer à sélectionner vos plats pour les semaines à venir.</p>

      <p style="margin: 30px 0; text-align: center;">
        <a href="${process.env.NEXTAUTH_URL}"
           style="background-color: #ea580c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
          Choisir mes plats
        </a>
      </p>

      <p style="color: #666; font-size: 14px;">
        À très bientôt,<br/>
        L'équipe FoxFood
      </p>
    </div>
  `

  let emailResult = { success: true }

  if (userEmail) {
    emailResult = await sendEmail({
      to: userEmail,
      subject,
      html: emailContent
    })
  }

  // Logger la notification
  await logNotification({
    notification_type: 'welcome_email',
    recipient_user_id: userId,
    recipient_email: userEmail,
    method: 'email',
    subject,
    content: emailContent,
    status: emailResult.success ? 'sent' : 'failed',
    error_message: emailResult.error || null
  })

  return emailResult
}

/**
 * Notifier l'utilisateur et l'admin d'un supplément tarifaire (> 4 personnes)
 */
export async function sendExtraFeeNotification({ userId, userName, userEmail, userPhone, householdSize }) {
  const subject = `Confirmation du supplément tarifaire - FoxFood`

  // Email pour l'utilisateur
  const userEmailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Confirmation de votre inscription</h2>
      <p>Bonjour ${userName},</p>
      <p>Merci d'avoir configuré votre compte FoxFood !</p>
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          <strong>Supplément tarifaire confirmé</strong><br/>
          Pour un foyer de <strong>${householdSize} personnes</strong>, un supplément de <strong>20€ par semaine</strong> sera appliqué.
        </p>
      </div>
      <p>Vous avez accepté ce supplément lors de votre inscription. Si vous avez des questions, n'hésitez pas à contacter Emeric.</p>
      <p style="color: #666; font-size: 14px;">
        À bientôt,<br/>
        L'équipe FoxFood
      </p>
    </div>
  `

  // Email pour l'admin
  const adminEmailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Nouveau client avec supplément tarifaire</h2>
      <p><strong>${userName}</strong> (${userEmail}) a terminé son inscription.</p>
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          <strong>Supplément applicable</strong><br/>
          Foyer de <strong>${householdSize} personnes</strong> = +20€/semaine
        </p>
      </div>
      <p>Le client a accepté le supplément tarifaire.</p>
      <p style="color: #666; font-size: 14px;">
        FoxFood - Notifications admin
      </p>
    </div>
  `

  const smsUserContent = `FoxFood: Merci ${userName}! Votre inscription est confirmée. Supplément de 20€/sem pour ${householdSize} pers. appliqué.`
  const smsAdminContent = `FoxFood: ${userName} inscrit avec ${householdSize} pers. (+20€/sem accepté)`

  let results = { user: {}, admin: {} }

  // Envoyer à l'utilisateur
  if (userEmail) {
    results.user.email = await sendEmail({
      to: userEmail,
      subject,
      html: userEmailContent
    })
  }

  if (userPhone) {
    results.user.sms = await sendSMS({
      to: userPhone,
      message: smsUserContent
    })
  }

  // Récupérer les paramètres admin pour envoyer la notification
  try {
    const adminSettings = await sql`
      SELECT notification_email, notification_phone, notify_on_selection_email, notify_on_selection_sms
      FROM admin_settings
      LIMIT 1
    `

    if (adminSettings.rows.length > 0) {
      const admin = adminSettings.rows[0]

      if (admin.notification_email) {
        results.admin.email = await sendEmail({
          to: admin.notification_email,
          subject: `Nouveau client: ${userName} (${householdSize} pers.)`,
          html: adminEmailContent
        })
      }

      if (admin.notification_phone) {
        results.admin.sms = await sendSMS({
          to: admin.notification_phone,
          message: smsAdminContent
        })
      }
    }
  } catch (error) {
    console.error('Erreur récupération admin settings:', error)
  }

  // Logger la notification
  await logNotification({
    notification_type: 'extra_fee_confirmation',
    recipient_user_id: userId,
    recipient_email: userEmail,
    recipient_phone: userPhone,
    method: 'both',
    subject,
    content: userEmailContent,
    status: 'sent'
  })

  return results
}

/**
 * Récupérer les remplacements d'ingrédients d'un utilisateur
 */
async function getUserIngredientReplacements(userId) {
  try {
    const result = await sql`
      SELECT
        original_ingredient_id,
        replacement_ingredient_id,
        ri.name as replacement_name,
        ri.category as replacement_category
      FROM user_ingredient_replacements r
      JOIN ingredients ri ON r.replacement_ingredient_id = ri.id
      WHERE r.user_id = ${userId}
    `

    // Créer un Map pour recherche rapide
    const replacements = new Map()
    result.rows.forEach(r => {
      replacements.set(r.original_ingredient_id, {
        replacementId: r.replacement_ingredient_id,
        replacementName: r.replacement_name,
        replacementCategory: r.replacement_category
      })
    })

    return replacements
  } catch (error) {
    console.error('Erreur récupération remplacements:', error)
    return new Map()
  }
}

/**
 * Récupérer les données de la liste de courses (ingrédients groupés par catégorie)
 */
export async function getShoppingListData({
  selectedDishes,
  householdSize = 1,
  userId = null
}) {
  if (!selectedDishes || selectedDishes.length === 0) {
    return null
  }

  try {
    // Récupérer les remplacements si userId fourni
    const userReplacements = userId ? await getUserIngredientReplacements(userId) : new Map()

    // Log pour debug
    if (userId && userReplacements.size > 0) {
      console.log(`🔄 [User ${userId}] ${userReplacements.size} remplacement(s) actif(s)`)
      for (const [originalId, replacement] of userReplacements.entries()) {
        console.log(`   Ingrédient ID ${originalId} → "${replacement.replacementName}"`)
      }
    }

    // Récupérer les ingrédients directement liés aux plats
    const ingredientsResult = await sql`
      SELECT
        i.id,
        i.name,
        i.category,
        di.quantity,
        di.unit,
        d.name as dish_name
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      JOIN dishes d ON di.dish_id = d.id
      WHERE di.dish_id = ANY(${selectedDishes})
      ORDER BY i.category, i.name
    `

    // Si aucun ingrédient lié trouvé dans dish_ingredients, fallback sur la colonne JSONB
    if (ingredientsResult.rows.length === 0) {
      const dishesWithJsonb = await sql`
        SELECT id, name, ingredients FROM dishes WHERE id = ANY(${selectedDishes})
      `
      const rawIngredientsList = []
      for (const dish of dishesWithJsonb.rows) {
        let ings = dish.ingredients
        if (typeof ings === 'string') { try { ings = JSON.parse(ings) } catch { ings = [] } }
        if (Array.isArray(ings) && ings.length > 0) {
          ings.forEach(ing => rawIngredientsList.push({ name: ing, dish_name: dish.name }))
        }
      }
      if (rawIngredientsList.length === 0) return null

      // Retourner les ingrédients bruts groupés
      const byCategory = new Map()
      byCategory.set('ingredients', rawIngredientsList.map(r => ({
        name: r.name, category: 'autre', quantity: 0, unit: '', dishes: [r.dish_name]
      })))
      return { ingredients: rawIngredientsList.map(r => ({
        name: r.name, category: 'autre', quantity: 0, unit: '', dishes: [r.dish_name]
      })), byCategory }
    }

    // Agréger les ingrédients en appliquant les remplacements
    const aggregatedIngredients = new Map()
    for (const row of ingredientsResult.rows) {
      // Vérifier si cet ingrédient a un remplacement
      let ingredientId = row.id
      let ingredientName = row.name
      let ingredientCategory = row.category || 'autre'

      if (userReplacements.has(row.id)) {
        const replacement = userReplacements.get(row.id)
        console.log(`   ✓ Remplacement appliqué: "${row.name}" (ID:${row.id}) → "${replacement.replacementName}"`)
        ingredientId = replacement.replacementId
        ingredientName = replacement.replacementName
        ingredientCategory = replacement.replacementCategory || 'autre'
      }

      const key = `${ingredientId}-${row.unit}`
      if (aggregatedIngredients.has(key)) {
        const existing = aggregatedIngredients.get(key)
        existing.quantity += row.quantity * householdSize
        existing.dishes.push(row.dish_name)
      } else {
        aggregatedIngredients.set(key, {
          name: ingredientName,
          category: ingredientCategory,
          quantity: row.quantity * householdSize,
          unit: row.unit,
          dishes: [row.dish_name]
        })
      }
    }

    // Grouper par catégorie
    const byCategory = new Map()
    for (const ing of aggregatedIngredients.values()) {
      if (!byCategory.has(ing.category)) {
        byCategory.set(ing.category, [])
      }
      byCategory.get(ing.category).push(ing)
    }

    return byCategory
  } catch (error) {
    console.error('Erreur récupération liste de courses:', error)
    return null
  }
}

/**
 * Générer le HTML de la liste de courses à partir des données
 * Utilise les 4 catégories simplifiées pour l'affichage
 */
export function generateShoppingListHtml(byCategory) {
  if (!byCategory || byCategory.size === 0) {
    return ''
  }

  // Mapping des catégories BDD vers les 4 catégories simplifiées
  const mapToShoppingCategory = (dbCategory) => {
    const mapping = {
      viande: 'frais',
      poisson: 'frais',
      produit_laitier: 'frais',
      oeuf: 'frais',
      legume: 'legumes',
      fruit: 'legumes',
      feculent: 'epicerie',
      epice: 'epicerie',
      condiment: 'epicerie',
      fruits_a_coque: 'epicerie',
      autre: 'epicerie',
      surgele: 'surgeles'
    }
    return mapping[dbCategory] || 'epicerie'
  }

  const shoppingCategoryLabels = {
    frais: 'Frais',
    legumes: 'Légumes',
    epicerie: 'Épicerie',
    surgeles: 'Surgelés'
  }

  // Regrouper les ingrédients par catégorie simplifiée
  const grouped = new Map()
  for (const [dbCat, ingredients] of byCategory) {
    const shopCat = mapToShoppingCategory(dbCat)
    if (!grouped.has(shopCat)) {
      grouped.set(shopCat, [])
    }
    grouped.get(shopCat).push(...ingredients)
  }

  const categoryOrder = ['frais', 'legumes', 'epicerie', 'surgeles']

  let html = ''
  for (const cat of categoryOrder) {
    if (grouped.has(cat)) {
      const items = grouped.get(cat)
      html += `
        <div style="margin-bottom: 15px;">
          <h4 style="color: #ea580c; margin-bottom: 8px; font-size: 14px;">${shoppingCategoryLabels[cat] || cat}</h4>
          <ul style="margin: 0; padding-left: 20px;">
      `
      for (const ing of items) {
        const qty = ing.quantity % 1 === 0 ? ing.quantity : ing.quantity.toFixed(1)
        html += `<li style="margin-bottom: 4px;">${ing.name}: ${qty} ${ing.unit || ''}</li>`
      }
      html += '</ul></div>'
    }
  }

  return html
}

/**
 * Envoyer la liste de courses à l'utilisateur après validation des plats
 */
export async function sendShoppingList({
  userId,
  userName,
  userEmail,
  householdSize,
  weekStartDate,
  selectedDishes
}) {
  if (!userEmail || !selectedDishes || selectedDishes.length === 0) {
    return { success: false, error: 'Données manquantes' }
  }

  try {
    // Récupérer les ingrédients directement liés aux plats
    const ingredientsResult = await sql`
      SELECT
        i.id,
        i.name,
        i.category,
        di.quantity,
        di.unit,
        d.name as dish_name
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      JOIN dishes d ON di.dish_id = d.id
      WHERE di.dish_id = ANY(${selectedDishes})
      ORDER BY i.category, i.name
    `

    if (ingredientsResult.rows.length === 0) {
      return { success: false, error: 'Aucun ingrédient trouvé' }
    }

    // Agréger les ingrédients (même ingrédient dans plusieurs plats)
    const aggregatedIngredients = new Map()
    const ingredientsByDish = new Map()

    for (const row of ingredientsResult.rows) {
      // Pour la liste groupée par ingrédient
      const key = `${row.id}-${row.unit}`
      if (aggregatedIngredients.has(key)) {
        const existing = aggregatedIngredients.get(key)
        existing.quantity += row.quantity * householdSize
        existing.dishes.push(row.dish_name)
      } else {
        aggregatedIngredients.set(key, {
          name: row.name,
          category: row.category || 'Autres',
          quantity: row.quantity * householdSize,
          unit: row.unit,
          dishes: [row.dish_name]
        })
      }

      // Pour la liste par plat
      if (!ingredientsByDish.has(row.dish_name)) {
        ingredientsByDish.set(row.dish_name, [])
      }
      ingredientsByDish.get(row.dish_name).push({
        name: row.name,
        category: row.category,
        quantity: row.quantity * householdSize,
        unit: row.unit
      })
    }

    // Grouper par catégorie
    const byCategory = new Map()
    for (const ing of aggregatedIngredients.values()) {
      if (!byCategory.has(ing.category)) {
        byCategory.set(ing.category, [])
      }
      byCategory.get(ing.category).push(ing)
    }

    // Formater la date
    const weekDate = new Date(weekStartDate)
    const formattedDate = weekDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })

    // Construire le HTML de l'email
    let ingredientsHtml = ''

    // Mapper vers les 4 catégories simplifiées
    const mapToShoppingCategory = (dbCategory) => {
      const mapping = {
        viande: 'frais', poisson: 'frais', produit_laitier: 'frais', oeuf: 'frais',
        legume: 'legumes', fruit: 'legumes',
        feculent: 'epicerie', epice: 'epicerie', condiment: 'epicerie', fruits_a_coque: 'epicerie', autre: 'epicerie',
        surgele: 'surgeles'
      }
      return mapping[dbCategory] || 'epicerie'
    }
    const shoppingCategoryLabels = {
      frais: '🥩 Frais', legumes: '🥬 Légumes', epicerie: '🥫 Épicerie', surgeles: '❄️ Surgelés'
    }

    // Regrouper par catégorie simplifiée
    const grouped = new Map()
    for (const [dbCat, ingredients] of byCategory) {
      const shopCat = mapToShoppingCategory(dbCat)
      if (!grouped.has(shopCat)) grouped.set(shopCat, [])
      grouped.get(shopCat).push(...ingredients)
    }

    // Liste groupée par catégorie
    const categoryOrder = ['frais', 'legumes', 'epicerie', 'surgeles']
    for (const cat of categoryOrder) {
      if (!grouped.has(cat)) continue
      const ingredients = grouped.get(cat)
      ingredientsHtml += `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #ea580c; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">
            ${shoppingCategoryLabels[cat]}
          </h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
      `
      for (const ing of ingredients) {
        const quantityStr = ing.quantity > 0 ? `${Math.round(ing.quantity)} ${ing.unit}` : ''
        ingredientsHtml += `<li><strong>${ing.name}</strong> ${quantityStr}</li>`
      }
      ingredientsHtml += '</ul></div>'
    }

    // Liste par plat
    let dishesHtml = ''
    for (const [dishName, ingredients] of ingredientsByDish) {
      const ingredientsList = ingredients.map(i => {
        // Pas de quantité pour les épices
        if (i.category === 'epice') {
          return i.name
        }
        return `${i.name} (${Math.round(i.quantity)} ${i.unit})`
      }).join(', ')

      dishesHtml += `
        <div style="margin-bottom: 15px; padding: 10px; background-color: #f9fafb; border-radius: 8px;">
          <h4 style="margin: 0 0 8px 0; color: #374151;">${dishName}</h4>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            ${ingredientsList}
          </p>
        </div>
      `
    }

    const subject = `🛒 Votre liste de courses - Semaine du ${formattedDate}`

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bonjour ${userName} ! 👋</h2>
        <p>Voici votre liste de courses pour la <strong>semaine du ${formattedDate}</strong>.</p>
        <p style="color: #6b7280;">Quantités calculées pour <strong>${householdSize} personne${householdSize > 1 ? 's' : ''}</strong>.</p>

        <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #ea580c;">🛒 Liste de courses</h3>
          ${ingredientsHtml}
        </div>

        <details style="margin: 20px 0;">
          <summary style="cursor: pointer; font-weight: bold; color: #374151; padding: 10px; background: #f3f4f6; border-radius: 8px;">
            📋 Détail par plat (${selectedDishes.length} plats)
          </summary>
          <div style="padding: 15px;">
            ${dishesHtml}
          </div>
        </details>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Bon appétit ! 🍽️<br/>
          L'équipe FoxFood
        </p>
      </div>
    `

    const emailResult = await sendEmail({
      to: userEmail,
      subject,
      html: emailContent
    })

    // Logger la notification
    await logNotification({
      notification_type: 'shopping_list',
      recipient_user_id: userId,
      recipient_email: userEmail,
      method: 'email',
      subject,
      content: `Liste de courses: ${aggregatedIngredients.size} ingrédients pour ${selectedDishes.length} plats`,
      status: emailResult.success ? 'sent' : 'failed',
      error_message: emailResult.error || null
    })

    return emailResult
  } catch (error) {
    console.error('Erreur envoi liste de courses:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Envoyer un récapitulatif complet au client (séparé par semaine avec liste de courses)
 */
export async function sendUserSelectionSummary({
  userId,
  userName,
  userEmail,
  householdSize,
  weeklyData // { week0: { date, dishes: [dishNames], shoppingListHtml }, week1: ..., }
}) {
  if (!userEmail || !weeklyData || Object.keys(weeklyData).length === 0) {
    return { success: false, error: 'Données manquantes' }
  }

  let totalDishes = 0
  let weeksHtml = ''

  for (const [weekKey, weekInfo] of Object.entries(weeklyData)) {
    if (!weekInfo || !weekInfo.dishes || weekInfo.dishes.length === 0) continue

    const weekDate = new Date(weekInfo.date)
    const formattedDate = weekDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })

    const dishList = weekInfo.dishes.map(d => `<li>${d}</li>`).join('')
    totalDishes += weekInfo.dishes.length

    // Liste de courses pour cette semaine
    let shoppingHtml = ''
    if (weekInfo.shoppingListHtml) {
      shoppingHtml = `
        <div style="background-color: #fff7ed; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <h4 style="margin: 0 0 10px 0; color: #ea580c; font-size: 14px;">🛒 Liste de courses</h4>
          ${weekInfo.shoppingListHtml}
        </div>
      `
    }

    weeksHtml += `
      <div style="margin-bottom: 30px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #ea580c;">
        <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 16px;">📅 Semaine du ${formattedDate}</h3>
        <div style="margin-bottom: 10px;">
          <strong style="color: #6b7280; font-size: 14px;">Vos plats :</strong>
          <ul style="margin: 5px 0; padding-left: 20px; line-height: 1.6;">
            ${dishList}
          </ul>
        </div>
        ${shoppingHtml}
      </div>
    `
  }

  const subject = `✅ Récapitulatif de votre sélection (${totalDishes} plats)`

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Bonjour ${userName} ! 👋</h2>
      <p>Votre sélection a bien été enregistrée. Voici le récapitulatif de vos <strong>${totalDishes} plat${totalDishes > 1 ? 's' : ''}</strong> :</p>
      <p style="color: #6b7280; font-size: 14px;">Quantités pour <strong>${householdSize} personne${householdSize > 1 ? 's' : ''}</strong></p>

      ${weeksHtml}

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        Bon appétit ! 🍽️<br/>
        L'équipe FoxFood
      </p>
    </div>
  `

  const emailResult = await sendEmail({
    to: userEmail,
    subject,
    html: emailContent
  })

  await logNotification({
    notification_type: 'user_selection_summary',
    recipient_user_id: userId,
    recipient_email: userEmail,
    method: 'email',
    subject,
    content: `Récap sélection: ${totalDishes} plats`,
    status: emailResult.success ? 'sent' : 'failed',
    error_message: emailResult.error || null
  })

  return emailResult
}

/**
 * Envoyer la liste de courses groupée (toutes semaines)
 */
export async function sendUserShoppingListGrouped({
  userId,
  userName,
  userEmail,
  householdSize,
  weeklySelections, // Même format que ci-dessus
  allDishIds
}) {
  if (!userEmail || !allDishIds || allDishIds.length === 0) {
    return { success: false, error: 'Données manquantes' }
  }

  try {
    // Récupérer les ingrédients directement liés aux plats
    const ingredientsResult = await sql`
      SELECT
        i.id,
        i.name,
        i.category,
        di.quantity,
        di.unit,
        d.name as dish_name
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      JOIN dishes d ON di.dish_id = d.id
      WHERE di.dish_id = ANY(${allDishIds})
      ORDER BY i.category, i.name
    `

    if (ingredientsResult.rows.length === 0) {
      return { success: false, error: 'Aucun ingrédient trouvé' }
    }

    // Agréger les ingrédients
    const aggregatedIngredients = new Map()
    for (const row of ingredientsResult.rows) {
      const key = `${row.id}-${row.unit}`
      if (aggregatedIngredients.has(key)) {
        const existing = aggregatedIngredients.get(key)
        existing.quantity += row.quantity * householdSize
      } else {
        aggregatedIngredients.set(key, {
          name: row.name,
          category: row.category || 'autre',
          quantity: row.quantity * householdSize,
          unit: row.unit
        })
      }
    }

    // Mapping des catégories vers les 4 catégories simplifiées
    const mapToShoppingCategory = (dbCategory) => {
      const mapping = {
        viande: 'frais',
        poisson: 'frais',
        produit_laitier: 'frais',
        oeuf: 'frais',
        legume: 'legumes',
        fruit: 'legumes',
        feculent: 'epicerie',
        epice: 'epicerie',
        condiment: 'epicerie',
        fruits_a_coque: 'epicerie',
        autre: 'epicerie',
        surgele: 'surgeles'
      }
      return mapping[dbCategory] || 'epicerie'
    }

    const shoppingCategoryLabels = {
      frais: 'Frais',
      legumes: 'Légumes',
      epicerie: 'Épicerie',
      surgeles: 'Surgelés'
    }

    // Grouper par catégorie simplifiée
    const grouped = new Map()
    for (const ing of aggregatedIngredients.values()) {
      const shopCat = mapToShoppingCategory(ing.category)
      if (!grouped.has(shopCat)) {
        grouped.set(shopCat, [])
      }
      grouped.get(shopCat).push(ing)
    }

    const categoryOrder = ['frais', 'legumes', 'epicerie', 'surgeles']

    // Construire le HTML de la liste de courses
    let ingredientsHtml = ''
    for (const cat of categoryOrder) {
      if (grouped.has(cat)) {
        const items = grouped.get(cat)
        ingredientsHtml += `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #ea580c; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">
              ${shoppingCategoryLabels[cat] || cat}
            </h3>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        `
        for (const ing of items) {
          const quantityStr = ing.quantity > 0 ? `${Math.round(ing.quantity)} ${ing.unit}` : ''
          ingredientsHtml += `<li><strong>${ing.name}</strong> ${quantityStr}</li>`
        }
        ingredientsHtml += '</ul></div>'
      }
    }

    // Construire le récap des semaines
    let weeksRecap = ''
    for (const [weekKey, weekData] of Object.entries(weeklySelections)) {
      if (!weekData || !weekData.dishes || weekData.dishes.length === 0) continue

      const weekDate = new Date(weekData.date)
      const formattedDate = weekDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long'
      })

      weeksRecap += `<li>Semaine du ${formattedDate}: ${weekData.dishes.length} plat${weekData.dishes.length > 1 ? 's' : ''}</li>`
    }

    const subject = `🛒 Votre liste de courses`

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bonjour ${userName} ! 👋</h2>
        <p>Voici votre liste de courses pour vos sélections :</p>

        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #374151;">📅 Récapitulatif</h4>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
            ${weeksRecap}
          </ul>
        </div>

        <p style="color: #6b7280;">Quantités calculées pour <strong>${householdSize} personne${householdSize > 1 ? 's' : ''}</strong>.</p>

        <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #ea580c;">🛒 Liste de courses</h3>
          ${ingredientsHtml}
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Bon appétit ! 🍽️<br/>
          L'équipe FoxFood
        </p>
      </div>
    `

    const emailResult = await sendEmail({
      to: userEmail,
      subject,
      html: emailContent
    })

    await logNotification({
      notification_type: 'shopping_list_grouped',
      recipient_user_id: userId,
      recipient_email: userEmail,
      method: 'email',
      subject,
      content: `Liste de courses groupée: ${aggregatedIngredients.size} ingrédients`,
      status: emailResult.success ? 'sent' : 'failed',
      error_message: emailResult.error || null
    })

    return emailResult
  } catch (error) {
    console.error('Erreur envoi liste de courses groupée:', error)
    return { success: false, error: error.message }
  }
}

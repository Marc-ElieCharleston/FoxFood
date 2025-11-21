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
 * Envoyer un SMS
 * TODO: Intégrer avec un service SMS (Twilio, Vonage, etc.)
 */
async function sendSMS({ to, message }) {
  // Pour l'instant, on simule l'envoi
  console.log(`SMS simulé vers ${to}: ${message}`)
  return { success: true, simulated: true }

  // Exemple avec Twilio (à décommenter et configurer):
  /*
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: message
      })
    })

    if (!response.ok) {
      throw new Error('Erreur Twilio')
    }

    const data = await response.json()
    return { success: true, id: data.sid }
  } catch (error) {
    console.error('Erreur lors de l\'envoi du SMS:', error)
    return { success: false, error: error.message }
  }
  */
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
export async function sendUserReminder({ userId, userName, userEmail, userPhone, daysBeforeDelivery, sendEmail: doEmail, sendSMS: doSMS }) {
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

  const smsContent = `Bonjour ${userName}, Emeric passe dans ${daysBeforeDelivery} jour(s). N'oubliez pas de sélectionner vos plats: ${process.env.NEXTAUTH_URL}`

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
    smsResult = await sendSMS({
      to: userPhone,
      message: smsContent
    })
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
 * Notifier l'admin qu'un client a fait sa sélection
 */
export async function notifyAdminOnSelection({ adminEmail, adminPhone, sendEmail: doEmail, sendSMS: doSMS, userName, userEmail, selectedDishes }) {
  const subject = `${userName} a fait sa sélection`

  const dishList = selectedDishes.map(d => `<li>${d}</li>`).join('')
  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Nouvelle sélection 🎉</h2>
      <p><strong>${userName}</strong> (${userEmail}) a terminé sa sélection :</p>
      <ul style="margin: 20px 0;">
        ${dishList}
      </ul>
      <p style="color: #666; font-size: 14px;">
        FoxFood - Notifications admin
      </p>
    </div>
  `

  const smsContent = `${userName} a fait sa sélection de ${selectedDishes.length} plat(s).`

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
  const subject = `Nouvelle demande de plat personnalisé de ${userName}`

  const ingredientsList = isDetailed && ingredients?.length > 0
    ? `<p><strong>Ingrédients suggérés :</strong></p><ul>${ingredients.map(i => `<li>${i}</li>`).join('')}</ul>`
    : ''

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Nouvelle demande de plat ✨</h2>
      <p><strong>${userName}</strong> (${userEmail}) a demandé un plat personnalisé :</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Plat :</strong> ${dishName}</p>
        <p><strong>Description :</strong> ${description}</p>
        <p><strong>Type :</strong> ${isDetailed ? 'Demande détaillée' : 'Demande simple'}</p>
        ${ingredientsList}
      </div>
      <p style="color: #666; font-size: 14px;">
        FoxFood - Notifications admin
      </p>
    </div>
  `

  const smsContent = `${userName} a demandé un plat personnalisé: ${dishName}`

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

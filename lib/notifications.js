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
 * Envoyer la liste de courses à l'utilisateur après validation des plats
 */
export async function sendShoppingList({
  userId,
  userName,
  userEmail,
  householdSize,
  weekStartDate,
  selectedDishes,
  selectedVariants
}) {
  if (!userEmail || !selectedDishes || selectedDishes.length === 0) {
    return { success: false, error: 'Données manquantes' }
  }

  try {
    // Récupérer les variantes sélectionnées ou par défaut pour chaque plat
    const variantIds = []
    for (const dishId of selectedDishes) {
      const variantId = selectedVariants[dishId]
      if (variantId) {
        variantIds.push(variantId)
      } else {
        // Récupérer la variante par défaut du plat
        const defaultVariant = await sql`
          SELECT id FROM dish_variants
          WHERE dish_id = ${dishId} AND is_default = true
          LIMIT 1
        `
        if (defaultVariant.rows.length > 0) {
          variantIds.push(defaultVariant.rows[0].id)
        }
      }
    }

    if (variantIds.length === 0) {
      return { success: false, error: 'Aucune variante trouvée' }
    }

    // Récupérer les ingrédients pour toutes les variantes
    const ingredientsResult = await sql`
      SELECT
        i.id,
        i.name,
        i.category,
        vi.quantity,
        vi.unit,
        d.name as dish_name
      FROM variant_ingredients vi
      JOIN ingredients i ON vi.ingredient_id = i.id
      JOIN dish_variants dv ON vi.variant_id = dv.id
      JOIN dishes d ON dv.dish_id = d.id
      WHERE vi.variant_id = ANY(${variantIds})
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

    // Liste groupée par catégorie
    for (const [category, ingredients] of byCategory) {
      ingredientsHtml += `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #ea580c; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">
            ${category}
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
      dishesHtml += `
        <div style="margin-bottom: 15px; padding: 10px; background-color: #f9fafb; border-radius: 8px;">
          <h4 style="margin: 0 0 8px 0; color: #374151;">${dishName}</h4>
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            ${ingredients.map(i => `${i.name} (${Math.round(i.quantity)} ${i.unit})`).join(', ')}
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

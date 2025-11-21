import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendShoppingReminder(user, dishes, deliveryDay) {
  if (!resend) {
    console.warn('Resend n\'est pas configuré')
    return { success: false, error: 'Resend not configured' }
  }

  const dishList = dishes.map(d => `- ${d.name}`).join('\n')

  try {
    const { data, error } = await resend.emails.send({
      from: 'FoxFood <noreply@foxfood.fr>',
      to: [user.email],
      subject: '🛒 Rappel: Courses à faire pour vos plats FoxFood',
      html: `
        <h2>Bonjour ${user.name}!</h2>
        <p>N'oubliez pas de faire vos courses pour les plats que vous avez sélectionnés:</p>
        <ul>
          ${dishes.map(d => `<li>${d.name}</li>`).join('')}
        </ul>
        <p><strong>Jour de passage d'Emeric:</strong> ${deliveryDay}</p>
        <p>À bientôt,<br>L'équipe FoxFood 🦊</p>
      `
    })

    if (error) {
      console.error('Erreur Resend:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error)
    return { success: false, error }
  }
}

export async function sendSelectionReminder(user) {
  if (!resend) {
    console.warn('Resend n\'est pas configuré')
    return { success: false, error: 'Resend not configured' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'FoxFood <noreply@foxfood.fr>',
      to: [user.email],
      subject: '⏰ Rappel: Choisissez vos plats de la semaine',
      html: `
        <h2>Bonjour ${user.name}!</h2>
        <p>Vous n'avez pas encore sélectionné vos plats pour cette semaine.</p>
        <p>Connectez-vous dès maintenant pour faire votre choix parmi notre catalogue:</p>
        <p><a href="${process.env.NEXTAUTH_URL}" style="display:inline-block;padding:12px 24px;background-color:#ea580c;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Choisir mes plats</a></p>
        <p>À bientôt,<br>L'équipe FoxFood 🦊</p>
      `
    })

    if (error) {
      console.error('Erreur Resend:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error)
    return { success: false, error }
  }
}

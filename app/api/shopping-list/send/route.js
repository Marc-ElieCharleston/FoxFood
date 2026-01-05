import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendShoppingList, getShoppingListData, generateShoppingListHtml } from '@/lib/notifications'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { dishes, variants, householdSize = 1, weekDate } = await request.json()

    if (!dishes || dishes.length === 0) {
      return NextResponse.json({ error: 'Aucun plat sélectionné' }, { status: 400 })
    }

    // Générer les données de la liste de courses
    const shoppingData = await getShoppingListData({
      selectedDishes: dishes,
      selectedVariants: variants || {},
      householdSize
    })

    if (!shoppingData) {
      return NextResponse.json({ error: 'Impossible de générer la liste' }, { status: 400 })
    }

    // Formater la date de la semaine
    let weekLabel = ''
    if (weekDate) {
      const date = new Date(weekDate)
      weekLabel = `Semaine du ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    }

    // Envoyer l'email
    const result = await sendShoppingList({
      userEmail: session.user.email,
      userName: session.user.name,
      shoppingData,
      weekLabel
    })

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: result.error || 'Erreur envoi' }, { status: 500 })
    }
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

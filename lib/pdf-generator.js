import jsPDF from 'jspdf'
import 'jspdf-autotable'

/**
 * Génère un PDF du récap de commande pour un client
 */
export function generateOrderRecapPDF({
  clientName,
  weekStart,
  householdSize,
  dishes,
  ingredients,
  deliveryDay,
  deliveryTime
}) {
  const doc = new jsPDF()

  // Couleurs FoxFood
  const primaryColor = [234, 88, 12] // Orange
  const grayColor = [100, 100, 100]

  // En-tête
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, 220, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text('🦊 FoxFood', 15, 20)

  doc.setFontSize(12)
  doc.text('Récapitulatif de commande', 15, 30)

  // Infos client
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.text(`Client : ${clientName}`, 15, 50)

  doc.setFontSize(11)
  doc.setTextColor(...grayColor)

  const weekDate = new Date(weekStart)
  const formattedDate = weekDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  doc.text(`Semaine du ${formattedDate}`, 15, 58)
  doc.text(`${householdSize} personne${householdSize > 1 ? 's' : ''}`, 15, 65)

  if (deliveryDay) {
    const timeLabel = deliveryTime === 'morning' ? 'Matin (8h-12h)' : 'Après-midi (14h-18h)'
    doc.text(`Passage : ${deliveryDay} - ${timeLabel}`, 15, 72)
  }

  // Section plats
  let yPos = 85

  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.text('📋 Vos plats sélectionnés', 15, yPos)
  yPos += 8

  // Table des plats
  const dishRows = dishes.map((dish, idx) => [
    idx + 1,
    dish.name
  ])

  doc.autoTable({
    startY: yPos,
    head: [['#', 'Plat']],
    body: dishRows,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: 255
    },
    styles: {
      fontSize: 10
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 150 }
    }
  })

  yPos = doc.lastAutoTable.finalY + 15

  // Section ingrédients (si disponibles)
  if (ingredients && Object.keys(ingredients).length > 0) {
    // Vérifier si on a besoin d'une nouvelle page
    if (yPos > 200) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(14)
    doc.text('🥕 Liste des ingrédients', 15, yPos)
    yPos += 8

    // Regrouper les catégories en rayons de courses
    const shoppingCategories = {
      frais: { label: 'Frais', categories: ['viande', 'poisson', 'produit_laitier', 'oeuf'] },
      legumes: { label: 'Légumes & Fruits', categories: ['legume', 'fruit'] },
      epicerie: { label: 'Épicerie', categories: ['feculent', 'epice', 'condiment', 'fruits_a_coque', 'autre'] },
      surgeles: { label: 'Surgelés', categories: ['surgele'] }
    }
    const shoppingOrder = ['frais', 'legumes', 'epicerie', 'surgeles']

    const ingredientRows = []
    shoppingOrder.forEach(shoppingCat => {
      const { label, categories } = shoppingCategories[shoppingCat]
      const shoppingItems = []
      categories.forEach(cat => {
        if (ingredients[cat] && ingredients[cat].length > 0) {
          shoppingItems.push(...ingredients[cat].map(i => ({ ...i, category: cat })))
        }
      })
      if (shoppingItems.length > 0) {
        shoppingItems.sort((a, b) => a.name.localeCompare(b.name))
        ingredientRows.push([{ content: label, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }])
        shoppingItems.forEach(ing => {
          if (ing.category === 'epice') {
            ingredientRows.push([ing.name, ''])
            return
          }
          const qty = ing.totalQuantity % 1 === 0 ? ing.totalQuantity : ing.totalQuantity.toFixed(1)
          ingredientRows.push([ing.name, `${qty}${ing.unit ? ' ' + ing.unit : ''}`])
        })
      }
    })

    if (ingredientRows.length > 0) {
      doc.autoTable({
        startY: yPos,
        body: ingredientRows,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 40, halign: 'right' }
        }
      })
    }
  }

  // Pied de page
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...grayColor)
    doc.text(
      `FoxFood - Généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${i}/${pageCount}`,
      105,
      290,
      { align: 'center' }
    )
  }

  return doc
}

/**
 * Génère un PDF du récap hebdomadaire pour l'admin
 */
export function generateAdminWeeklyRecapPDF({
  weekStart,
  weekEnd,
  clients,
  ingredients,
  totalDishes,
  totalPersons
}) {
  const doc = new jsPDF()

  const primaryColor = [234, 88, 12]
  const grayColor = [100, 100, 100]

  // En-tête
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, 220, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text('🦊 FoxFood - Admin', 15, 20)

  doc.setFontSize(12)
  doc.text('Récapitulatif hebdomadaire', 15, 30)

  // Infos semaine
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(12)

  const startDate = new Date(weekStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const endDate = new Date(weekEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  doc.text(`Semaine du ${startDate} au ${endDate}`, 15, 50)

  // Stats
  doc.setFontSize(10)
  doc.setTextColor(...grayColor)
  doc.text(`${clients.length} clients | ${totalDishes} plats | ${totalPersons} couverts`, 15, 58)

  let yPos = 70

  // Liste des clients
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.text('👥 Commandes par client', 15, yPos)
  yPos += 8

  const clientRows = []
  clients.forEach(client => {
    clientRows.push([
      client.name,
      `${client.householdSize} pers.`,
      client.dishes.map(d => d.name).join(', '),
      `${client.deliveryDay}\n${client.deliveryTime === 'morning' ? 'Matin' : 'Après-midi'}`
    ])
  })

  doc.autoTable({
    startY: yPos,
    head: [['Client', 'Pers.', 'Plats', 'Passage']],
    body: clientRows,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: 255
    },
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 20 },
      2: { cellWidth: 90 },
      3: { cellWidth: 30 }
    }
  })

  // Nouvelle page pour les ingrédients
  doc.addPage()

  yPos = 20
  doc.setFontSize(14)
  doc.text('🛒 Liste des courses', 15, yPos)
  yPos += 10

  // Regrouper les catégories en rayons de courses
  const shoppingCategories = {
    frais: { label: '🥩 Frais', categories: ['viande', 'poisson', 'produit_laitier', 'oeuf'] },
    legumes: { label: '🥬 Légumes & Fruits', categories: ['legume', 'fruit'] },
    epicerie: { label: '🛒 Épicerie', categories: ['feculent', 'epice', 'condiment', 'fruits_a_coque', 'autre'] },
    surgeles: { label: '❄️ Surgelés', categories: ['surgele'] }
  }
  const shoppingOrder = ['frais', 'legumes', 'epicerie', 'surgeles']

  shoppingOrder.forEach(shoppingCat => {
    const { label, categories } = shoppingCategories[shoppingCat]

    // Collecter tous les ingrédients de ce rayon
    const shoppingItems = []
    categories.forEach(cat => {
      if (ingredients[cat] && ingredients[cat].length > 0) {
        shoppingItems.push(...ingredients[cat].map(i => ({ ...i, category: cat })))
      }
    })

    if (shoppingItems.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      // Trier par nom
      shoppingItems.sort((a, b) => a.name.localeCompare(b.name))

      doc.setFontSize(11)
      doc.setTextColor(...primaryColor)
      doc.text(label, 15, yPos)
      yPos += 6

      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)

      shoppingItems.forEach(ing => {
        doc.text(`• ${ing.name}`, 20, yPos)
        if (ing.category !== 'epice') {
          const qty = ing.totalQuantity % 1 === 0 ? ing.totalQuantity : ing.totalQuantity.toFixed(1)
          doc.text(`${qty}${ing.unit ? ' ' + ing.unit : ''}`, 120, yPos)
        }
        yPos += 5
      })

      yPos += 5
    }
  })

  // Pied de page
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...grayColor)
    doc.text(
      `FoxFood Admin - Généré le ${new Date().toLocaleDateString('fr-FR')} - Page ${i}/${pageCount}`,
      105,
      290,
      { align: 'center' }
    )
  }

  return doc
}

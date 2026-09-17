import { supabase } from './supabase.js'

// Convertit une quantité de la recette (g, ml, unité) vers l'unité du stock (kg, L, unité)
function convertirVersUniteStock(quantite, uniteRecette, uniteStock) {
  if (uniteRecette === uniteStock) {
    return quantite
  }
  if (uniteRecette === 'g' && uniteStock === 'kg') {
    return quantite / 1000
  }
  if (uniteRecette === 'ml' && uniteStock === 'L') {
    return quantite / 1000
  }
  // Cas non prévu : on ne convertit pas, mais on prévient
  console.log(`⚠️ Conversion non gérée : ${uniteRecette} → ${uniteStock}`)
  return quantite
}

// Vend un plat : déduit le stock de chaque ingrédient de sa recette.
// Retourne un résumé structuré (utilisé par l'interface web) en plus des logs console (utiles en CLI).
export async function vendrePlat(platId) {
  // erreurCode/alertes restent des données structurées (pas de texte figé) pour que l'interface web
  // puisse les traduire ; les console.log gardent leur texte français fixe, réservé au CLI.
  const resultat = { succes: true, erreurCode: null, erreurMessage: null, lignes: [], alertes: [] }

  const { data: recette, error: erreurRecette } = await supabase
    .from('recettes')
    .select('ingredient_id, quantite, unite')
    .eq('plat_id', platId)

  if (erreurRecette) {
    console.log('Erreur en cherchant la recette:', erreurRecette)
    resultat.succes = false
    resultat.erreurCode = 'erreur_supabase'
    resultat.erreurMessage = erreurRecette.message
    return resultat
  }

  if (recette.length === 0) {
    console.log('Aucune recette trouvée pour ce plat.')
    resultat.succes = false
    resultat.erreurCode = 'recette_introuvable'
    return resultat
  }

  console.log(`Recette trouvée : ${recette.length} ingrédients à déduire`)

  for (const ligne of recette) {
    const { data: ingredient, error: erreurIngredient } = await supabase
      .from('ingredients')
      .select('nom, unite, stock_actuel, seuil_minimum')
      .eq('id', ligne.ingredient_id)
      .single()

    if (erreurIngredient) {
      console.log("Erreur en cherchant l'ingrédient:", erreurIngredient)
      resultat.alertes.push({ type: 'erreur_ingredient', message: erreurIngredient.message })
      continue
    }

    // Conversion de la quantité de la recette vers l'unité du stock
    const quantiteConvertie = convertirVersUniteStock(ligne.quantite, ligne.unite, ingredient.unite)
    const nouveauStock = ingredient.stock_actuel - quantiteConvertie

    const { error: erreurUpdate } = await supabase
      .from('ingredients')
      .update({ stock_actuel: nouveauStock })
      .eq('id', ligne.ingredient_id)

    if (erreurUpdate) {
      console.log('Erreur en mettant à jour le stock:', erreurUpdate)
      resultat.alertes.push({ type: 'erreur_stock', ingredient: ingredient.nom, message: erreurUpdate.message })
      continue
    }

    console.log(`${ingredient.nom}: ${ingredient.stock_actuel} → ${nouveauStock} ${ingredient.unite}`)

    // Trace du mouvement pour l'historique. Non bloquant : une vente ne doit pas échouer
    // si cette seule écriture secondaire rate (l'ingrédient est déjà correctement déduit).
    const { error: erreurMouvement } = await supabase
      .from('mouvements_stock')
      .insert({ ingredient_id: ligne.ingredient_id, quantite: -quantiteConvertie, motif: 'vente' })

    if (erreurMouvement) {
      console.log("Erreur en enregistrant le mouvement d'historique:", erreurMouvement)
    }

    resultat.lignes.push({
      nom: ingredient.nom,
      avant: ingredient.stock_actuel,
      apres: nouveauStock,
      unite: ingredient.unite,
    })

    if (nouveauStock < ingredient.seuil_minimum) {
      console.log(`⚠️ ALERTE : ${ingredient.nom} est sous le seuil minimum !`)
      resultat.alertes.push({ type: 'seuil_minimum', ingredient: ingredient.nom, unite: ingredient.unite })
    }
  }

  console.log('Vente terminée, stock mis à jour.')
  return resultat
}

// Exécution directe en CLI (ex: `node vendre.js`) : on simule la vente d'un Sandwich Poulet (plat_id = 3)
// `window` n'existe qu'au navigateur : ce bloc ne s'exécute donc pas quand l'interface web importe vendrePlat.
if (typeof window === 'undefined') {
  vendrePlat(3)
}

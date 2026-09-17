import { supabase } from './supabase.js'

// Convertit une quantité de la recette (g, ml, unité) vers l'unité du stock (kg, L, unité)
// Exportée pour être réutilisée par statistiques.js dans le calcul du coût des plats.
export function convertirVersUniteStock(quantite, uniteRecette, uniteStock) {
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

  // Un seul aller-retour pour tous les ingrédients de la recette, au lieu d'un SELECT par ligne :
  // c'était la principale source de lenteur (jusqu'à 3 requêtes séquentielles par ingrédient).
  const ingredientIds = [...new Set(recette.map((ligne) => ligne.ingredient_id))]
  const { data: ingredients, error: erreurIngredients } = await supabase
    .from('ingredients')
    .select('id, nom, unite, prix_achat, stock_actuel, seuil_minimum')
    .in('id', ingredientIds)

  if (erreurIngredients) {
    console.log('Erreur en cherchant les ingrédients:', erreurIngredients)
    resultat.succes = false
    resultat.erreurCode = 'erreur_supabase'
    resultat.erreurMessage = erreurIngredients.message
    return resultat
  }

  const ingredientParId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))

  // Regroupe par ingrédient (une recette peut en théorie lister deux fois le même ingrédient)
  // pour n'avoir qu'une seule déduction — donc une seule ligne d'upsert — par ingrédient.
  const quantiteConvertieParIngredient = new Map()
  for (const ligne of recette) {
    const ingredient = ingredientParId.get(ligne.ingredient_id)
    if (!ingredient) {
      console.log(`Ingrédient #${ligne.ingredient_id} introuvable`)
      resultat.alertes.push({ type: 'erreur_ingredient', message: `Ingrédient #${ligne.ingredient_id} introuvable` })
      continue
    }
    const quantiteConvertie = convertirVersUniteStock(ligne.quantite, ligne.unite, ingredient.unite)
    quantiteConvertieParIngredient.set(
      ligne.ingredient_id,
      (quantiteConvertieParIngredient.get(ligne.ingredient_id) ?? 0) + quantiteConvertie,
    )
  }

  const deductions = [...quantiteConvertieParIngredient.entries()].map(([ingredientId, quantiteConvertie]) => {
    const ingredient = ingredientParId.get(ingredientId)
    return { ingredient, quantiteConvertie, nouveauStock: ingredient.stock_actuel - quantiteConvertie }
  })

  // Vérifié AVANT toute écriture : une vente est tout ou rien, elle ne doit pas laisser
  // certains ingrédients déduits et d'autres non si l'un d'eux manque de stock.
  const enRupture = deductions.find((deduction) => deduction.nouveauStock < 0)
  if (enRupture) {
    console.log(`⚠️ Stock insuffisant pour ${enRupture.ingredient.nom}`)
    resultat.succes = false
    resultat.erreurCode = 'stock_negatif'
    resultat.ingredient = enRupture.ingredient.nom
    resultat.stock = enRupture.ingredient.stock_actuel
    resultat.unite = enRupture.ingredient.unite
    return resultat
  }

  if (deductions.length > 0) {
    // upsert plutôt que N update : une seule requête où chaque ingrédient porte sa propre
    // nouvelle valeur. Postgres valide les contraintes NOT NULL de toute la ligne même pour un
    // conflit qui finit en UPDATE (INSERT ... ON CONFLICT DO UPDATE) : on doit donc renvoyer les
    // colonnes obligatoires telles quelles, pas seulement stock_actuel.
    const { error: erreurUpdate } = await supabase.from('ingredients').upsert(
      deductions.map((d) => ({
        id: d.ingredient.id,
        nom: d.ingredient.nom,
        unite: d.ingredient.unite,
        prix_achat: d.ingredient.prix_achat,
        seuil_minimum: d.ingredient.seuil_minimum,
        stock_actuel: d.nouveauStock,
      })),
    )

    if (erreurUpdate) {
      console.log('Erreur en mettant à jour le stock:', erreurUpdate)
      resultat.succes = false
      resultat.erreurCode = 'erreur_supabase'
      resultat.erreurMessage = erreurUpdate.message
      return resultat
    }

    for (const { ingredient, nouveauStock } of deductions) {
      console.log(`${ingredient.nom}: ${ingredient.stock_actuel} → ${nouveauStock} ${ingredient.unite}`)
      resultat.lignes.push({ nom: ingredient.nom, avant: ingredient.stock_actuel, apres: nouveauStock, unite: ingredient.unite })

      if (nouveauStock < ingredient.seuil_minimum) {
        console.log(`⚠️ ALERTE : ${ingredient.nom} est sous le seuil minimum !`)
        resultat.alertes.push({ type: 'seuil_minimum', ingredient: ingredient.nom, unite: ingredient.unite })
      }
    }
  }

  // Traces secondaires (historique + statistiques), non bloquantes : le stock est déjà
  // correctement déduit, une vente ne doit pas échouer si l'une de ces deux écritures rate.
  // Indépendantes l'une de l'autre -> lancées en parallèle plutôt qu'en séquence.
  const [{ error: erreurMouvements }, { error: erreurVente }] = await Promise.all([
    deductions.length > 0
      ? supabase
          .from('mouvements_stock')
          .insert(deductions.map((d) => ({ ingredient_id: d.ingredient.id, quantite: -d.quantiteConvertie, motif: 'vente' })))
      : Promise.resolve({ error: null }),
    supabase.from('ventes').insert({ plat_id: platId }),
  ])

  if (erreurMouvements) {
    console.log("Erreur en enregistrant les mouvements d'historique:", erreurMouvements)
  }
  if (erreurVente) {
    console.log('Erreur en enregistrant la vente:', erreurVente)
  }

  console.log('Vente terminée, stock mis à jour.')
  return resultat
}

// Exécution directe en CLI (ex: `node vendre.js`) : on simule la vente d'un Sandwich Poulet (plat_id = 3)
// `window` n'existe qu'au navigateur : ce bloc ne s'exécute donc pas quand l'interface web importe vendrePlat.
if (typeof window === 'undefined') {
  vendrePlat(3)
}

import { supabase } from './supabase.js'

// Sens du mouvement selon le motif : + pour un ajout au stock, - pour un retrait.
export const SIGNES_MOTIF = {
  ajout: 1,
  retrait: -1,
}

// Enregistre un mouvement de stock : met à jour ingredients.stock_actuel et trace le mouvement.
// Retourne un résultat structuré (comme vendrePlat dans vendre.js) pour que l'UI décide de l'affichage.
export async function enregistrerMouvementStock(ingredient, motif, quantiteSaisie) {
  const quantiteSignee = quantiteSaisie * SIGNES_MOTIF[motif]
  const avant = ingredient.stock_actuel
  const apres = avant + quantiteSignee

  if (apres < 0) {
    return { succes: false, erreurCode: 'stock_negatif', avant }
  }

  const { error: erreurStock } = await supabase.from('ingredients').update({ stock_actuel: apres }).eq('id', ingredient.id)

  if (erreurStock) {
    return { succes: false, erreurCode: 'erreur_supabase', erreurMessage: erreurStock.message }
  }

  const { error: erreurMouvement } = await supabase
    .from('mouvements_stock')
    .insert({ ingredient_id: ingredient.id, quantite: quantiteSignee, motif })

  if (erreurMouvement) {
    return { succes: false, erreurCode: 'erreur_supabase', erreurMessage: erreurMouvement.message }
  }

  return { succes: true, avant, apres }
}

// Sur mobile, chaque <td> affiche le libellé de sa colonne via data-label (voir style.css).
// On lit les <th> du tableau pour poser ces attributs, plutôt que de dupliquer les libellés
// dans chaque fonction d'affichage : ça reste juste même quand la langue change.
export function appliquerEtiquettesTableau(idCorps) {
  const corps = document.getElementById(idCorps)
  if (!corps) return

  const table = corps.closest('table')
  const enTetes = [...table.querySelectorAll('thead th')].map((th) => th.textContent)

  for (const ligne of corps.rows) {
    // Ignore les lignes type "Chargement...", "Aucune donnée" (un seul <td colspan="n">).
    if (ligne.cells.length !== enTetes.length) continue

    for (let i = 0; i < ligne.cells.length; i++) {
      ligne.cells[i].setAttribute('data-label', enTetes[i])
    }
  }
}

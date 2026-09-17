// Menu hamburger mobile : ouvre/ferme le bloc nav + sélecteur de langue sous 768px.
// Ne fait rien sur desktop (le bouton y est masqué en CSS, .header-right toujours visible).

const bouton = document.querySelector('.nav-toggle')
const panneau = document.querySelector('.header-right')

function fermerMenu() {
  panneau.classList.remove('ouvert')
  bouton.setAttribute('aria-expanded', 'false')
}

if (bouton && panneau) {
  bouton.addEventListener('click', () => {
    const estOuvert = panneau.classList.toggle('ouvert')
    bouton.setAttribute('aria-expanded', String(estOuvert))
  })

  panneau.querySelectorAll('nav a').forEach((lien) => {
    lien.addEventListener('click', fermerMenu)
  })
}

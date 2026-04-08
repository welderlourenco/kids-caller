import { navigate } from '../router'

export function renderHome(app: HTMLDivElement) {
  app.innerHTML = `
    <div class="home">
      <div class="home__header">
        <svg class="home__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <h1 class="home__title">Kids Caller</h1>
        <p class="home__subtitle">Sistema de chamada do ministério infantil</p>
      </div>
      <div class="home__actions">
        <button class="home__btn home__btn--sender" data-role="sender">
          <svg class="home__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2L11 13"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z"/>
          </svg>
          <span class="home__btn-label">Enviar Chamado</span>
          <span class="home__btn-desc">Digitar número da criança</span>
        </button>
        <button class="home__btn home__btn--receiver" data-role="receiver">
          <svg class="home__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span class="home__btn-label">Receber Chamados</span>
          <span class="home__btn-desc">Painel de notificações</span>
        </button>
      </div>
    </div>
  `

  app.querySelector('[data-role="sender"]')!.addEventListener('click', () => {
    navigate('/sender')
  })

  app.querySelector('[data-role="receiver"]')!.addEventListener('click', () => {
    navigate('/receiver')
  })
}

import { navigate } from '../router'
import { supabase } from '../supabase'

interface Chamado {
  id: number
  child_number: string
  created_at: string
  read: boolean
  acknowledged: boolean
}

// ---------------------------------------------------------------------------
// Alert sound (AudioContext two-tone chime)
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null

function playAlertSound() {
  if (!audioCtx) audioCtx = new AudioContext()
  const ctx = audioCtx

  const now = ctx.currentTime
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.25, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
  gain.connect(ctx.destination)

  const osc1 = ctx.createOscillator()
  osc1.frequency.value = 440
  osc1.connect(gain)
  osc1.start(now)
  osc1.stop(now + 0.15)

  const osc2 = ctx.createOscillator()
  osc2.frequency.value = 660
  osc2.connect(gain)
  osc2.start(now + 0.15)
  osc2.stop(now + 0.35)
}

// ---------------------------------------------------------------------------
// Wake Lock
// ---------------------------------------------------------------------------

let wakeLock: WakeLockSentinel | null = null

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => {
      wakeLock = null
    })
  } catch {
    /* device may not support it */
  }
}

function releaseWakeLock() {
  wakeLock?.release()
  wakeLock = null
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && !wakeLock) {
    requestWakeLock()
  }
}

// ---------------------------------------------------------------------------
// Web Notifications
// ---------------------------------------------------------------------------

function requestNotificationPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function sendNotification(childNumber: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification('Kids Caller', {
    body: `Criança #${childNumber}`,
    icon: '/favicon.svg',
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export function renderReceiver(app: HTMLDivElement) {
  let chamados: Chamado[] = []
  let lastReceivedAt: string | null = null
  let destroyed = false

  // --- Markup ---
  app.innerHTML = `
    <div class="recv">
      <header class="recv__header">
        <button class="back-btn" data-back>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
          Voltar
        </button>
        <h1 class="recv__title">Chamados</h1>
        <div class="recv__status">
          <span class="recv__badge" data-badge>0</span>
          <span class="recv__dot" data-dot></span>
          <span class="recv__status-label" data-status-label>Conectando…</span>
        </div>
      </header>

      <div class="recv__notif-warning" data-notif-warning hidden>
        Notificações bloqueadas — ative nas configurações do browser
      </div>

      <div class="recv__toolbar" data-toolbar hidden>
        <button class="recv__clear-btn" data-clear>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Limpar Tudo
        </button>
      </div>

      <div class="recv__confirm" data-confirm hidden>
        <p>Apagar todos os chamados?</p>
        <div class="recv__confirm-actions">
          <button class="recv__confirm-btn recv__confirm-btn--cancel" data-confirm-cancel>Cancelar</button>
          <button class="recv__confirm-btn recv__confirm-btn--delete" data-confirm-delete>Apagar</button>
        </div>
      </div>

      <div class="recv__list" data-list></div>

      <div class="recv__empty" data-empty>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <p>Nenhum chamado ainda</p>
      </div>
    </div>`

  // --- DOM refs ---
  const listEl = app.querySelector<HTMLDivElement>('[data-list]')!
  const emptyEl = app.querySelector<HTMLDivElement>('[data-empty]')!
  const dotEl = app.querySelector<HTMLSpanElement>('[data-dot]')!
  const statusLabel = app.querySelector<HTMLSpanElement>('[data-status-label]')!
  const badgeEl = app.querySelector<HTMLSpanElement>('[data-badge]')!
  const notifWarning = app.querySelector<HTMLDivElement>('[data-notif-warning]')!
  const toolbarEl = app.querySelector<HTMLDivElement>('[data-toolbar]')!
  const confirmEl = app.querySelector<HTMLDivElement>('[data-confirm]')!

  // --- Rendering helpers ---

  function updateUnreadCount() {
    const count = chamados.filter((c) => !c.read).length
    badgeEl.textContent = String(count)
    badgeEl.classList.toggle('recv__badge--hidden', count === 0)
  }

  function setConnectionStatus(ok: boolean) {
    dotEl.classList.toggle('recv__dot--ok', ok)
    dotEl.classList.toggle('recv__dot--err', !ok)
    statusLabel.textContent = ok ? 'Conectado' : 'Reconectando…'
  }

  function renderCard(c: Chamado): string {
    const cardClass = c.acknowledged
      ? 'recv__card recv__card--acknowledged'
      : c.read
        ? 'recv__card'
        : 'recv__card recv__card--unread'

    let action = ''
    if (c.acknowledged) {
      action = '<div class="recv__card-row"><span class="recv__card-confirmed">Confirmado ✓</span></div>'
    } else if (!c.read) {
      action = `<div class="recv__card-row"><button class="recv__card-ack" data-ack="${c.id}">✓ Confirmar</button></div>`
    }

    return `<div class="${cardClass}" data-id="${c.id}">
      <div class="recv__card-top">
        <span class="recv__card-number">#${c.child_number}</span>
        <span class="recv__card-time">${formatTime(c.created_at)}</span>
        ${!c.read && !c.acknowledged ? '<span class="recv__card-novo">Novo</span>' : ''}
      </div>
      ${action}
    </div>`
  }

  function renderList() {
    listEl.innerHTML = chamados.map(renderCard).join('')
    emptyEl.hidden = chamados.length > 0
    toolbarEl.hidden = chamados.length === 0
    updateUnreadCount()
  }

  function addChamado(row: Chamado) {
    // Prevent duplicates
    if (chamados.some((c) => c.id === row.id)) return
    chamados.unshift(row)
    lastReceivedAt = row.created_at
    renderList()
    playAlertSound()
    sendNotification(row.child_number)
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
  }

  // --- Mark as read ---

  listEl.addEventListener('click', async (e) => {
    const card = (e.target as HTMLElement).closest<HTMLDivElement>('[data-id]')
    if (!card) return
    const id = Number(card.dataset.id)
    const chamado = chamados.find((c) => c.id === id)
    if (!chamado || chamado.read) return

    chamado.read = true
    renderList()
    await supabase.from('chamados').update({ read: true }).eq('id', id)
  })

  // --- Acknowledge ---

  listEl.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ack]')
    if (!btn) return
    e.stopPropagation()
    const id = Number(btn.dataset.ack)
    const chamado = chamados.find((c) => c.id === id)
    if (!chamado || chamado.acknowledged) return

    chamado.acknowledged = true
    chamado.read = true
    renderList()
    await supabase.from('chamados').update({ acknowledged: true, read: true }).eq('id', id)
  })

  // --- Clear all ---

  app.querySelector('[data-clear]')!.addEventListener('click', () => {
    confirmEl.hidden = false
  })

  app.querySelector('[data-confirm-cancel]')!.addEventListener('click', () => {
    confirmEl.hidden = true
  })

  app.querySelector('[data-confirm-delete]')!.addEventListener('click', async () => {
    confirmEl.hidden = true
    const ids = chamados.map((c) => c.id)
    chamados = []
    lastReceivedAt = null
    renderList()
    await supabase.from('chamados').delete().in('id', ids)
  })

  // --- Initial load ---

  async function loadInitial() {
    const { data } = await supabase
      .from('chamados')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data && !destroyed) {
      chamados = data as Chamado[]
      if (chamados.length > 0) {
        lastReceivedAt = chamados[0].created_at
      }
      renderList()
    }
  }

  // --- Gap fill on reconnect ---

  async function fillGap() {
    if (!lastReceivedAt) return loadInitial()
    const { data } = await supabase
      .from('chamados')
      .select('*')
      .gt('created_at', lastReceivedAt)
      .order('created_at', { ascending: false })
    if (data && !destroyed) {
      for (const row of (data as Chamado[]).reverse()) {
        addChamado(row)
      }
    }
  }

  // --- Realtime subscription ---

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const channel = supabase
    .channel('chamados-inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chamados' },
      (payload) => {
        if (!destroyed) addChamado(payload.new as Chamado)
      },
    )
    .subscribe((status) => {
      if (destroyed) return
      if (status === 'SUBSCRIBED') {
        setConnectionStatus(true)
        // Fill any missed chamados on reconnect
        fillGap()
      } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setConnectionStatus(false)
        // Auto-reconnect attempt
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            if (!destroyed) channel.subscribe()
          }, 3000)
        }
      }
    })

  // --- Notifications ---

  requestNotificationPermission()
  // Show warning if blocked
  setTimeout(() => {
    if ('Notification' in window && Notification.permission === 'denied') {
      notifWarning.hidden = false
    }
  }, 1000)

  // --- Wake Lock ---

  requestWakeLock()
  document.addEventListener('visibilitychange', onVisibilityChange)

  // --- Back button ---

  app.querySelector('[data-back]')!.addEventListener('click', () => {
    navigate('/')
  })

  // --- Cleanup on navigation ---

  function cleanup() {
    destroyed = true
    supabase.removeChannel(channel)
    if (reconnectTimer) clearTimeout(reconnectTimer)
    releaseWakeLock()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('hashchange', cleanup)
  }

  window.addEventListener('hashchange', cleanup)

  // --- Kick off ---

  loadInitial()
}

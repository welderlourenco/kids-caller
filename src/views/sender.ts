import { navigate } from '../router'
import { supabase } from '../supabase'

const MAX_DIGITS = 4

// ---------------------------------------------------------------------------
// Confirmation sound (short high-pitch beep)
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null

function playConfirmSound() {
  if (!audioCtx) audioCtx = new AudioContext()
  const ctx = audioCtx

  const now = ctx.currentTime
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  gain.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.frequency.value = 880
  osc.connect(gain)
  osc.start(now)
  osc.stop(now + 0.15)
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

export function renderSender(app: HTMLDivElement) {
  let display = ''
  let sending = false
  const pendingIds = new Set<number>()

  app.innerHTML = `
    <div class="pin-view">
      <button class="back-btn" data-back>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5"/>
          <path d="M12 19l-7-7 7-7"/>
        </svg>
        Voltar
      </button>

      <div class="pin-view__body">
        <div class="pin-toast" data-toast hidden></div>
        <div class="pin-display" data-display>---</div>

        <div class="pin-grid">
          <button class="pin-btn" data-digit="1">1</button>
          <button class="pin-btn" data-digit="2">2</button>
          <button class="pin-btn" data-digit="3">3</button>
          <button class="pin-btn" data-digit="4">4</button>
          <button class="pin-btn" data-digit="5">5</button>
          <button class="pin-btn" data-digit="6">6</button>
          <button class="pin-btn" data-digit="7">7</button>
          <button class="pin-btn" data-digit="8">8</button>
          <button class="pin-btn" data-digit="9">9</button>
          <button class="pin-btn pin-btn--backspace" data-backspace aria-label="Apagar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
              <line x1="18" y1="9" x2="12" y2="15"/>
              <line x1="12" y1="9" x2="18" y2="15"/>
            </svg>
          </button>
          <button class="pin-btn" data-digit="0">0</button>
          <button class="pin-btn pin-btn--send" data-send disabled aria-label="Enviar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `

  const displayEl = app.querySelector<HTMLDivElement>('[data-display]')!
  const sendBtn = app.querySelector<HTMLButtonElement>('[data-send]')!
  const toastEl = app.querySelector<HTMLDivElement>('[data-toast]')!

  function updateDisplay() {
    displayEl.textContent = display || '---'
    displayEl.classList.toggle('pin-display--empty', display === '')
    sendBtn.disabled = display === '' || sending
  }

  app.querySelector('[data-back]')!.addEventListener('click', () => {
    navigate('/')
  })

  app.querySelector('.pin-grid')!.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-digit]')
    if (!target || sending) return
    const digit = target.dataset.digit!
    if (display.length < MAX_DIGITS) {
      display += digit
      updateDisplay()
    }
  })

  app.querySelector('[data-backspace]')!.addEventListener('click', () => {
    if (sending) return
    display = display.slice(0, -1)
    updateDisplay()
  })

  sendBtn.addEventListener('click', async () => {
    if (!display || sending) return
    sending = true
    sendBtn.disabled = true

    const value = display

    const { data, error } = await supabase
      .from('chamados')
      .insert({ child_number: value })
      .select('id')
      .single()

    if (error || !data) {
      displayEl.textContent = 'Erro!'
      displayEl.classList.add('pin-display--error')
      setTimeout(() => {
        displayEl.classList.remove('pin-display--error')
        sending = false
        updateDisplay()
      }, 1500)
    } else {
      pendingIds.add(data.id)
      displayEl.textContent = '✓'
      displayEl.classList.add('pin-display--success')
      setTimeout(() => {
        displayEl.classList.remove('pin-display--success')
        display = ''
        sending = false
        updateDisplay()
      }, 1000)
    }
  })

  // --- Toast helper ---

  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    toastEl.textContent = message
    toastEl.hidden = false
    toastEl.classList.add('pin-toast--visible')
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('pin-toast--visible')
      toastTimer = setTimeout(() => {
        toastEl.hidden = true
        toastTimer = null
      }, 300)
    }, 3000)
  }

  // --- Realtime subscription for acknowledgements ---

  const ackChannel = supabase
    .channel('chamados-acks')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chamados' },
      (payload) => {
        const row = payload.new as { id: number; child_number: string; acknowledged: boolean }
        if (row.acknowledged && pendingIds.has(row.id)) {
          pendingIds.delete(row.id)
          playConfirmSound()
          showToast(`Chamado #${row.child_number} recebido! ✓`)
        }
      },
    )
    .subscribe()

  // --- Wake Lock ---

  requestWakeLock()
  document.addEventListener('visibilitychange', onVisibilityChange)

  // --- Cleanup on navigation ---

  function cleanup() {
    supabase.removeChannel(ackChannel)
    releaseWakeLock()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('hashchange', cleanup)
  }

  window.addEventListener('hashchange', cleanup)
}

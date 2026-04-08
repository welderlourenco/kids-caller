export type Route = '/' | '/sender' | '/receiver'

type RouteHandler = (app: HTMLDivElement) => void

const routes = new Map<Route, RouteHandler>()

let appEl: HTMLDivElement

export function registerRoute(path: Route, handler: RouteHandler) {
  routes.set(path, handler)
}

export function navigate(path: Route) {
  window.location.hash = path === '/' ? '/' : path
}

function getRoute(): Route {
  const hash = window.location.hash.replace('#', '') || '/'
  if (hash === '/sender') return '/sender'
  if (hash === '/receiver') return '/receiver'
  return '/'
}

function render() {
  const route = getRoute()
  const handler = routes.get(route)
  if (handler) {
    appEl.innerHTML = ''
    handler(appEl)
  }
}

export function initRouter(el: HTMLDivElement) {
  appEl = el
  window.addEventListener('hashchange', render)
  render()
}

import './style.css'
import './supabase' // initialize Supabase connection + test
import { registerRoute, initRouter } from './router'
import { renderHome } from './views/home'
import { renderSender } from './views/sender'
import { renderReceiver } from './views/receiver'

registerRoute('/', renderHome)
registerRoute('/sender', renderSender)
registerRoute('/receiver', renderReceiver)

initRouter(document.querySelector<HTMLDivElement>('#app')!)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your credentials.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Connection test — logs to console on startup
supabase.from('chamados').select('count', { count: 'exact', head: true }).then(
  ({ error }) => {
    if (error) {
      console.warn('[Supabase] Connection test warning:', error.message)
      console.info('[Supabase] This is expected if the "chamados" table does not exist yet.')
    } else {
      console.info('[Supabase] Connected successfully.')
    }
  }
)

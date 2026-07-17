import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Cookies cannot be written during a Server Component render. Safe to
            // ignore: token refresh is handled by the browser client SDK and the
            // auth route handlers, not by edge middleware (which makes no Supabase
            // network calls — see commit e701d51, the Vercel 504 fix).
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // See note in `set` above — cookie removal during a Server Component
            // render is a no-op and is handled by the client SDK / route handlers.
          }
        },
      },
    }
  )
}

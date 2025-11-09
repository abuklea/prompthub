/*
Project: PromptHub
Author: Allan James
Source: src/lib/supabase/client.ts
MIME: text/typescript
Type: TypeScript Module

Created: 08/11/2025 15:14 GMT+10
Last modified: 08/11/2025 15:14 GMT+10
---------------
Client-side Supabase client for browser-only operations.
Used in client components that need Supabase access.

Changelog:
08/11/2025 15:14 GMT+10 | Initial creation for client-side Supabase operations (P5S4T2)
*/

import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

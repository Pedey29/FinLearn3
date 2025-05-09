// Type declarations for Deno URL imports

declare module 'https://deno.land/std@0.177.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.49.4' {
  export * from '@supabase/supabase-js';
}

declare module 'https://esm.sh/openai@3.3.0' {
  export * from 'openai';
} 
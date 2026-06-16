// Supabase Edge Function: get-model-url
// Validates a preview token and returns a 30-day signed URL for a .frag file.
//
// Set these secrets in Supabase Dashboard → Edge Functions → Secrets:
//   PREVIEW_TOKENS  — comma-separated tokens, e.g. "tok-abc123,tok-xyz456"
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically)
//
// POST body: { previewToken: string, filename: string }
// Response:  { signedUrl: string }  |  { error: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'CNTSPC_BIM_CRD_IFC-FRG';
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60 * 24 * 30; // 30 days

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  // Parse body
  let previewToken: string | undefined;
  let filename: string | undefined;
  try {
    ({ previewToken, filename } = await req.json());
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!previewToken || !filename) {
    return json({ error: 'Missing previewToken or filename' }, 400);
  }

  // Sanitise filename — only safe characters, must end with .frag (no path traversal)
  const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  if (!safeName.endsWith('.frag')) {
    return json({ error: 'Only .frag files are accessible via this endpoint' }, 400);
  }

  // Validate token against the PREVIEW_TOKENS secret
  const rawTokens = Deno.env.get('PREVIEW_TOKENS') ?? '';
  const validTokens = rawTokens.split(',').map((t) => t.trim()).filter(Boolean);
  if (!validTokens.includes(previewToken)) {
    return json({ error: 'Invalid or expired preview token' }, 403);
  }

  // Generate signed URL — service role key never touches the browser
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(safeName, SIGNED_URL_EXPIRES_SECONDS);

  if (error || !data?.signedUrl) {
    console.error('[get-model-url] createSignedUrl error:', error);
    return json({ error: error?.message ?? 'Could not generate signed URL' }, 500);
  }

  return json({ signedUrl: data.signedUrl }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

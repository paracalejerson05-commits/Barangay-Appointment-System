import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function normalizeSupabaseUrl(input?: string): string {
  if (!input || typeof input !== 'string') return '';
  let url = input.trim();
  if (!url) return '';

  // If user only provided the project reference ID (e.g., "yvbiztjaxrtahsgzizdt")
  if (!url.includes('.') && !url.includes('://')) {
    url = `https://${url}.supabase.co`;
  } else if (!/^https?:\/\//i.test(url)) {
    // If user provided a domain without protocol (e.g. "yvbiztjaxrtahsgzizdt.supabase.co")
    url = `https://${url}`;
  }

  // Strip trailing /rest/v1 or trailing slashes
  url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // Ignore URL parse error and fall back to defaultUrl
  }

  return '';
}

const env = (import.meta as any).env || {};
const rawUrl = String(env.VITE_SUPABASE_URL || '').trim();
export const supabaseUrl = normalizeSupabaseUrl(rawUrl);
export const supabaseKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

const safeSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeSupabaseKey = supabaseKey || 'missing-publishable-key';

function initSupabaseClient(): SupabaseClient {
  try {
    return createClient(safeSupabaseUrl, safeSupabaseKey);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return createClient('https://placeholder.supabase.co', 'missing-publishable-key');
  }
}

export const supabase = initSupabaseClient();
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

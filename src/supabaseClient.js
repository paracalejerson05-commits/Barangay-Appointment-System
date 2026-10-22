import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(input) {
  if (!input || typeof input !== 'string') return '';
  let url = input.trim();
  if (!url) return '';

  if (!url.includes('.') && !url.includes('://')) {
    url = `https://${url}.supabase.co`;
  } else if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // Strip trailing /rest/v1 or /auth/v1 paths
  url = url.replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // ignore
  }

  return '';
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseUrl = normalizeSupabaseUrl(rawUrl);
const supabaseKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'missing-publishable-key'
);
export default supabase;

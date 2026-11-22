import { createClient } from '@supabase/supabase-js';

export const isCloudConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('hk_sb_url');
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('hk_sb_key');
  return Boolean(url && key && url.startsWith('http'));
};

export const getSupabase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('hk_sb_url') || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('hk_sb_key') || '';
  if (!url || !key || !url.startsWith('http')) return null;
  return createClient(url, key);
};

export const saveCloudConfig = (url, key) => {
  localStorage.setItem('hk_sb_url', url.trim());
  localStorage.setItem('hk_sb_key', key.trim());
};

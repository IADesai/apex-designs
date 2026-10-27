import { createClient } from '@supabase/supabase-js';
import type { JourneyEvent, LeadStatus } from '../../lib/admin-helpers';

export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string | null;
  business: string | null;
  package: string | null;
  message: string;
  ref: string | null;
  first_ref: string | null;
  visitor_id: string | null;
  status: LeadStatus;
  notes: string | null;
}

export interface LinkStat {
  id: string;
  slug: string;
  label: string;
  channel: string;
  destination: string;
  created_at: string;
  landings: number;
  visitors: number;
  leads: number;
}

export function createApi(url: string, key: string) {
  const db = createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } });

  const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

  return {
    db,
    async session() {
      const { data } = await db.auth.getSession();
      return data.session;
    },
    async sendMagicLink(email: string) {
      const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/admin/`, shouldCreateUser: false } });
      fail(error);
    },
    async signOut() {
      await db.auth.signOut();
    },
    async isAdmin(): Promise<boolean> {
      const { data, error } = await db.rpc('is_admin');
      fail(error);
      return data === true;
    },
    async leads(status?: LeadStatus): Promise<Lead[]> {
      let q = db.from('leads').select('*');
      if (status) q = q.eq('status', status);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(500);
      fail(error);
      return (data ?? []) as Lead[];
    },
    async lead(id: string): Promise<Lead | null> {
      const { data, error } = await db.from('leads').select('*').eq('id', id).maybeSingle();
      fail(error);
      return data as Lead | null;
    },
    async updateLead(id: string, patch: Partial<Pick<Lead, 'status' | 'notes'>>) {
      const { error } = await db.from('leads').update(patch).eq('id', id);
      fail(error);
    },
    async journey(visitorId: string): Promise<JourneyEvent[]> {
      const { data, error } = await db.from('events').select('type,path,ref,props,created_at').eq('visitor_id', visitorId).order('created_at').limit(1000);
      fail(error);
      return (data ?? []) as JourneyEvent[];
    },
    async linkStats(): Promise<LinkStat[]> {
      const { data, error } = await db.from('link_stats').select('*').order('created_at', { ascending: false });
      fail(error);
      return (data ?? []) as LinkStat[];
    },
    async createLink(input: { slug: string; label: string; channel: string; destination: string }) {
      const { error } = await db.from('links').insert(input);
      fail(error);
    },
    async overview(days = 30) {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const countEvents = async (type: string) => {
        const { count, error } = await db.from('events').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('type', type);
        fail(error);
        return count ?? 0;
      };
      const countLeads = async () => {
        const { count, error } = await db.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', since);
        fail(error);
        return count ?? 0;
      };
      const [landings, views, leads] = await Promise.all([countEvents('ref_landing'), countEvents('page_view'), countLeads()]);
      return { landings, views, leads };
    },
  };
}

export type Api = ReturnType<typeof createApi>;

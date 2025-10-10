import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    const { token } = JSON.parse(event.body || '{}');
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'missing_token' }) };

    const { data: req, error: e1 } = await supabase
      .from('requests').select('id, hold_until, extend_used_at').eq('status_token', token).single();
    if (e1 || !req) return { statusCode: 404, body: JSON.stringify({ error: 'not_found' }) };

    const today = new Date(); today.setHours(0,0,0,0);
    const used = req.extend_used_at ? new Date(req.extend_used_at) : null;
    if (used) used.setHours(0,0,0,0);
    if (used && used.getTime() === today.getTime()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'once_per_day' }) };
    }

    const base = req.hold_until ? new Date(req.hold_until).getTime() : Date.now();
    const extended = new Date(Math.max(base, Date.now()) + 15*60*1000).toISOString();

    const { error: e2 } = await supabase
      .from('requests').update({
        hold_until: extended,
        extend_used_at: today.toISOString().slice(0,10)
      }).eq('id', req.id);
    if (e2) throw e2;

    return { statusCode: 200, body: JSON.stringify({ ok: true, hold_until: extended }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error' }) };
  }
};


import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    const { token } = JSON.parse(event.body || '{}');
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'missing_token' }) };

    const { data: req, error: e1 } = await supabase
      .from('requests').select('id').eq('status_token', token).single();
    if (e1 || !req) return { statusCode: 404, body: JSON.stringify({ error: 'not_found' }) };

    const holdUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: e2 } = await supabase
      .from('requests').update({ status: 'reserved', hold_until: holdUntil }).eq('id', req.id);
    if (e2) throw e2;

    return { statusCode: 200, body: JSON.stringify({ ok: true, hold_until: holdUntil }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error' }) };
  }
};


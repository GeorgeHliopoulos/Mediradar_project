import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  if (!apiKey || apiKey !== process.env.PHARMACY_API_KEY)
    return { statusCode: 401, body: JSON.stringify({ error: 'unauthorized' }) };

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    const { token, pharmacy_name, phone = '', address = '', lat = null, lng = null } = JSON.parse(event.body || '{}');
    if (!token || !pharmacy_name) return { statusCode: 400, body: JSON.stringify({ error: 'invalid_payload' }) };

    const { data: req, error: e1 } = await supabase
      .from('requests').select('id,status').eq('status_token', token).single();
    if (e1 || !req) return { statusCode: 404, body: JSON.stringify({ error: 'not_found' }) };

    const { error: e2 } = await supabase.from('replies').insert([{
      request_id: req.id, pharmacy_name, phone, address, lat, lng, available: true
    }]);
    if (e2) throw e2;

    if (req.status === 'pending') {
      await supabase.from('requests').update({ status: 'available' }).eq('id', req.id);
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error' }) };
  }
};


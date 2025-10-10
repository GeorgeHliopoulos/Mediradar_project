import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    const b = JSON.parse(event.body || '{}');
    const {
      lang = 'el', city = '', medicine_name, substance = '', type = '',
      quantity = 1, allow_generic = false, rx_number = ''
    } = b;

    if (!medicine_name || !quantity || quantity < 1)
      return { statusCode: 400, body: JSON.stringify({ error: 'invalid_payload' }) };

    const token = Math.random().toString(36).slice(2, 10);

    const { data, error } = await supabase
      .from('requests')
      .insert([{
        lang, city, medicine_name, substance, type, quantity,
        allow_generic, rx_number, status: 'pending', status_token: token
      }])
      .select('id, status_token').single();

    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ ok: true, request_id: data.id, token: data.status_token }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error' }) };
  }
};


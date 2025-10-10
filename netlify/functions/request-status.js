import { createClient } from '@supabase/supabase-js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  console.log('[request-status] RPC mode');

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    const token = event.queryStringParameters?.token;
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'missing_token' }) };

    const { data: reqRows, error: e1 } = await supabase.rpc('get_request_status', { p_token: token });
    if (e1 || !reqRows || !reqRows.length)
      return { statusCode: 404, body: JSON.stringify({ error: 'not_found' }) };
    const req = reqRows[0];

    const { data: reps, error: e2 } = await supabase.rpc('get_replies_by_token', { p_token: token });
    if (e2) throw e2;

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: req.status,
        hold_until: req.hold_until,
        extend_used_at: req.extend_used_at,
        city: req.city,
        medicine_name: req.medicine_name,
        replies: reps || []
      })
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error' }) };
  }
};


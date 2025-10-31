import { requireAdmin, jsonResponse, writeAuditLog } from './_admin-helpers.js';

function parseLimit(value, fallback = 100) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num) || num <= 0) return fallback;
  return Math.min(num, 500);
}

export const handler = async (event) => {
  if (!['GET', 'PATCH'].includes(event.httpMethod)) {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const adminContext = await requireAdmin(event);
  if (adminContext.error) {
    return adminContext.error;
  }

  const { supabase, user } = adminContext;

  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    const limit = parseLimit(params.limit);
    const status = params.status ? params.status.toLowerCase() : null;
    const city = params.city ? params.city.trim() : null;
    const q = params.q ? params.q.trim() : null;

    try {
      let query = supabase
        .from('requests')
        .select('id, created_at, updated_at, status, city, medicine_name, substance, quantity, allow_generic, rx_number')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }
      if (city) {
        query = query.ilike('city', `%${city}%`);
      }
      if (q) {
        const like = `%${q}%`;
        query = query.or(`medicine_name.ilike.${like},substance.ilike.${like},rx_number.ilike.${like}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return jsonResponse(200, { items: data || [], count: data?.length || 0 });
    } catch (error) {
      console.error('[admin-requests] query failed', error);
      return jsonResponse(500, { error: 'server_error' });
    }
  }

  try {
    const { id, status, note } = JSON.parse(event.body || '{}');
    if (!id || !status) {
      return jsonResponse(400, { error: 'invalid_payload' });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('requests')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return jsonResponse(404, { error: 'not_found' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('requests')
      .update({ status })
      .eq('id', id)
      .select('id, status, updated_at')
      .maybeSingle();
    if (updateError) throw updateError;

    await writeAuditLog(supabase, {
      user,
      action: 'request_status_update',
      targetType: 'request',
      targetId: id,
      metadata: { from: existing.status, to: status, note: note || null }
    });

    return jsonResponse(200, { item: updated });
  } catch (error) {
    console.error('[admin-requests] update failed', error);
    return jsonResponse(500, { error: 'server_error' });
  }
};

import { requireAdmin, jsonResponse, writeAuditLog } from './_admin-helpers.js';

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'suspended']);

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
    const status = params.status ? params.status.toLowerCase() : null;

    try {
      let query = supabase
        .from('pharmacies')
        .select('id, name, city, address, phone, status, updated_at, created_at')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (status && ALLOWED_STATUSES.has(status)) {
        query = query.eq('status', status);
      }
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse(200, { items: data || [] });
    } catch (error) {
      console.error('[admin-pharmacies] query failed', error);
      return jsonResponse(500, { error: 'server_error' });
    }
  }

  try {
    const { id, status, reason } = JSON.parse(event.body || '{}');
    if (!id || !status || !ALLOWED_STATUSES.has(status.toLowerCase())) {
      return jsonResponse(400, { error: 'invalid_payload' });
    }

    const normalizedStatus = status.toLowerCase();

    const { data: existing, error: fetchError } = await supabase
      .from('pharmacies')
      .select('id, status, name')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return jsonResponse(404, { error: 'not_found' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('pharmacies')
      .update({ status: normalizedStatus })
      .eq('id', id)
      .select('id, name, status, updated_at')
      .maybeSingle();
    if (updateError) throw updateError;

    await writeAuditLog(supabase, {
      user,
      action: 'pharmacy_status_update',
      targetType: 'pharmacy',
      targetId: id,
      metadata: {
        name: existing.name,
        from: existing.status,
        to: normalizedStatus,
        reason: reason || null
      }
    });

    return jsonResponse(200, { item: updated });
  } catch (error) {
    console.error('[admin-pharmacies] update failed', error);
    return jsonResponse(500, { error: 'server_error' });
  }
};

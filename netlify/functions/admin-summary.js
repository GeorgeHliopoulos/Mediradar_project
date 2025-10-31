import { requireAdmin, jsonResponse } from './_admin-helpers.js';

function buildStatusBreakdown(rows) {
  const summary = {};
  rows.forEach(row => {
    const key = (row.status || 'unknown').toLowerCase();
    summary[key] = (summary[key] || 0) + 1;
  });
  return summary;
}

function groupRequestsByDay(rows) {
  const byDate = new Map();
  rows.forEach(row => {
    if (!row.created_at) return;
    const parsed = new Date(row.created_at);
    if (Number.isNaN(parsed.getTime())) return;
    const date = parsed.toISOString().slice(0, 10);
    if (!byDate.has(date)) {
      byDate.set(date, { date, total: 0, pending: 0, resolved: 0 });
    }
    const bucket = byDate.get(date);
    bucket.total += 1;
    if ((row.status || '').toLowerCase() === 'pending') bucket.pending += 1;
    if (['available', 'reserved', 'completed'].includes((row.status || '').toLowerCase())) {
      bucket.resolved += 1;
    }
  });
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const adminContext = await requireAdmin(event);
  if (adminContext.error) {
    return adminContext.error;
  }

  const { supabase, user } = adminContext;

  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [totalRequests, pendingRequests, activeRequests, pharmaciesTotal, pharmaciesApproved, pharmaciesSuspended] = await Promise.all([
      supabase.from('requests').select('id', { count: 'exact', head: true }),
      supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('requests').select('id', { count: 'exact', head: true }).in('status', ['available', 'reserved', 'completed']),
      supabase.from('pharmacies').select('id', { count: 'exact', head: true }),
      supabase.from('pharmacies').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('pharmacies').select('id', { count: 'exact', head: true }).eq('status', 'suspended')
    ]);

    const { data: recentRequests, error: recentError } = await supabase
      .from('requests')
      .select('id, status, created_at, city')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(500);
    if (recentError) throw recentError;

    const statusBreakdown = buildStatusBreakdown(recentRequests || []);
    const requestsByDay = groupRequestsByDay(recentRequests || []);

    const { data: pharmacySnapshot, error: pharmacyError } = await supabase
      .from('pharmacies')
      .select('id, name, status, city, updated_at')
      .order('updated_at', { ascending: false })
      .limit(8);
    if (pharmacyError) throw pharmacyError;

    const { data: auditLog, error: auditError } = await supabase
      .from('admin_audit_logs')
      .select('id, created_at, action, target_type, target_id, actor_email')
      .order('created_at', { ascending: false })
      .limit(10);
    if (auditError) throw auditError;

    let totalUsers = 0;
    try {
      const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1 });
      if (usersError) throw usersError;
      totalUsers = usersData?.total ?? usersData?.users?.length ?? 0;
    } catch (error) {
      console.warn('[admin-summary] Failed to count users', error);
    }

    return jsonResponse(200, {
      metrics: {
        totalRequests: totalRequests.count ?? 0,
        pendingRequests: pendingRequests.count ?? 0,
        activeRequests: activeRequests.count ?? 0,
        pharmacies: pharmaciesTotal.count ?? 0,
        pharmaciesApproved: pharmaciesApproved.count ?? 0,
        pharmaciesSuspended: pharmaciesSuspended.count ?? 0,
        users: totalUsers
      },
      statusBreakdown,
      requestsByDay,
      pharmacySnapshot: pharmacySnapshot || [],
      auditLog: auditLog || [],
      generatedAt: new Date().toISOString(),
      actor: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('[admin-summary] unexpected error', error);
    return jsonResponse(500, { error: 'server_error' });
  }
};

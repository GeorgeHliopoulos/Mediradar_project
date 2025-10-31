import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

function ensureConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error('Supabase environment variables are not configured');
  }
}

function normalizeRoleSource(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (typeof source === 'string') return source.split(',');
  if (typeof source === 'object') return Object.values(source);
  return [];
}

function extractRoles(user) {
  const roles = new Set();
  if (!user) return roles;
  [
    user.role,
    user.app_metadata?.role,
    user.app_metadata?.roles,
    user.user_metadata?.role,
    user.user_metadata?.roles
  ].forEach(source => {
    normalizeRoleSource(source).forEach(role => {
      if (typeof role === 'string' && role.trim()) {
        roles.add(role.trim().toLowerCase());
      }
    });
  });
  return roles;
}

export async function requireAdmin(event, { roles = ['admin'] } = {}) {
  try {
    ensureConfig();
  } catch (error) {
    return { error: jsonResponse(500, { error: 'config_error', message: error.message }) };
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: jsonResponse(401, { error: 'missing_token' }) };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { error: jsonResponse(401, { error: 'invalid_token' }) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { error: jsonResponse(401, { error: 'invalid_token' }) };
  }

  const roleSet = extractRoles(data.user);
  const required = Array.isArray(roles) ? roles : [roles];
  const allowed = required.every(role => !role || roleSet.has(role.toString().toLowerCase()));
  if (!allowed) {
    return { error: jsonResponse(403, { error: 'forbidden' }) };
  }

  return { supabase, user: data.user, roleSet, token };
}

export async function writeAuditLog(supabase, { user, action, targetType, targetId, metadata = {} }) {
  if (!supabase) return;
  try {
    await supabase.from('admin_audit_logs').insert({
      action,
      target_type: targetType,
      target_id: targetId,
      meta: metadata,
      actor_id: user?.id || null,
      actor_email: user?.email || user?.user_metadata?.email || null
    });
  } catch (error) {
    console.error('[admin] Failed to write audit log', error);
  }
}

export { jsonResponse };

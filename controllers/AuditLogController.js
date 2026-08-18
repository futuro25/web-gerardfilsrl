"use strict";

const self = {};
const supabase = require("./db");

const MAX_LIMIT = 200;

function emptyPage(page, limit) {
  return { data: [], total: 0, page: parseInt(page), limit: parseInt(limit) };
}

self.getAuditLog = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      user_id,
      entity,
      action,
      from,
      to,
      search,
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit) || 50, MAX_LIMIT);
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    let query = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + parsedLimit - 1);

    if (user_id) query = query.eq("user_id", parseInt(user_id, 10));
    if (entity) query = query.eq("entity", entity);
    if (action) query = query.eq("action", action);
    if (from) query = query.gte("created_at", new Date(from).toISOString());
    if (to) query = query.lte("created_at", new Date(to).toISOString());
    if (search) {
      const term = String(search).trim();
      query = query.or(
        `username.ilike.%${term}%,entity.ilike.%${term}%,entity_id.ilike.%${term}%,path.ilike.%${term}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      data: data || [],
      total: count || 0,
      page: parsedPage,
      limit: parsedLimit,
    });
  } catch (e) {
    console.error("getAuditLog", e.message);
    res.status(500).json({ error: e.message });
  }
};

// Alimenta los combos de filtro de la pantalla de auditoria.
self.getAuditLogFilters = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("audit_log")
      .select("entity, user_id, username")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) throw error;

    const entities = [...new Set((data || []).map((row) => row.entity))]
      .filter(Boolean)
      .sort();

    const usersMap = new Map();
    (data || []).forEach((row) => {
      if (row.user_id && !usersMap.has(row.user_id)) {
        usersMap.set(row.user_id, row.username || `Usuario ${row.user_id}`);
      }
    });

    const users = [...usersMap.entries()]
      .map(([id, username]) => ({ id, username }))
      .sort((a, b) => a.username.localeCompare(b.username));

    res.json({ entities, users });
  } catch (e) {
    console.error("getAuditLogFilters", e.message);
    res.status(500).json({ error: e.message });
  }
};

module.exports = self;

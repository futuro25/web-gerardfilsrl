"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

// Una sesion se considera viva mientras siga llegando el heartbeat (cada 45s en el cliente).
const ONLINE_WINDOW_SECONDS = 150;
// Sin interaccion real (mouse/teclado/scroll) durante este tiempo, el usuario pasa a "inactivo".
const IDLE_AFTER_SECONDS = 300;

const STATUS_PRIORITY = { activo: 3, inactivo: 2, offline: 1 };

function errorMessage(e) {
  if (!e) return "Error desconocido";
  const detail = e.message || e.details || e.hint || e.code;
  if (detail) return detail;
  return "No se pudo acceder a user_sessions (¿falta correr la migración?)";
}

function secondsSince(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 1000));
}

function sessionStatus(session) {
  if (session.ended_at) return "offline";

  const sinceSeen = secondsSince(session.last_seen_at);
  if (sinceSeen == null || sinceSeen > ONLINE_WINDOW_SECONDS) return "offline";

  const sinceActivity = secondsSince(session.last_activity_at);
  if (session.is_idle) return "inactivo";
  if (sinceActivity != null && sinceActivity > IDLE_AFTER_SECONDS) return "inactivo";

  return "activo";
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || null;
}

function normalizePath(value) {
  const path = String(value || "").trim();
  return path ? path.slice(0, 200) : null;
}

self.startSession = async (req, res) => {
  try {
    const user_id = parseInt(req.body.user_id, 10);
    const session_token = String(req.body.session_token || "").trim();

    if (!Number.isInteger(user_id) || !session_token) {
      return res.status(400).json({ error: "user_id y session_token son obligatorios" });
    }

    const now = new Date();
    const row = {
      user_id,
      session_token,
      started_at: now,
      last_seen_at: now,
      last_activity_at: now,
      ended_at: null,
      is_idle: false,
      current_path: normalizePath(req.body.path),
      user_agent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
      ip: getClientIp(req),
    };

    const { data, error } = await supabase
      .from("user_sessions")
      .upsert(row, { onConflict: "session_token" })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (e) {
    const message = errorMessage(e);
    console.error("presence startSession", message);
    res.status(500).json({ error: message });
  }
};

self.heartbeat = async (req, res) => {
  try {
    const session_token = String(req.body.session_token || "").trim();
    if (!session_token) {
      return res.status(400).json({ error: "session_token es obligatorio" });
    }

    const now = new Date();
    const isIdle = req.body.is_idle === true || req.body.is_idle === "true";

    const update = {
      last_seen_at: now,
      is_idle: isIdle,
      current_path: normalizePath(req.body.path),
      ended_at: null,
    };

    // Solo movemos last_activity_at cuando el cliente reporta interaccion real.
    if (!isIdle) update.last_activity_at = now;

    const { data, error } = await supabase
      .from("user_sessions")
      .update(update)
      .eq("session_token", session_token)
      .select()
      .maybeSingle();

    if (error) throw error;

    // La sesion se perdio (base reiniciada o token viejo): el cliente la vuelve a crear.
    if (!data) return res.status(404).json({ error: "session not found" });

    res.json(data);
  } catch (e) {
    const message = errorMessage(e);
    console.error("presence heartbeat", message);
    res.status(500).json({ error: message });
  }
};

self.endSession = async (req, res) => {
  try {
    const session_token = String(req.body.session_token || "").trim();
    if (!session_token) {
      return res.status(400).json({ error: "session_token es obligatorio" });
    }

    // El navegador manda el cierre en cada recarga de pagina. Si la sesion se
    // acaba de (re)abrir, ignoramos el cierre para no marcar offline al usuario
    // que simplemente esta navegando la plataforma.
    const graceCutoff = new Date(Date.now() - 5000).toISOString();

    const { error } = await supabase
      .from("user_sessions")
      .update({ ended_at: new Date() })
      .eq("session_token", session_token)
      .is("ended_at", null)
      .lt("started_at", graceCutoff);

    if (error) throw error;

    res.json({ ok: true });
  } catch (e) {
    const message = errorMessage(e);
    console.error("presence endSession", message);
    res.status(500).json({ error: message });
  }
};

self.getPresence = async (req, res) => {
  try {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, last_name, username, email, type, picture, last_login")
      .is("deleted_at", null);

    if (usersError) throw usersError;

    // Alcanza con las sesiones recientes: cualquier cosa mas vieja ya es offline.
    const since = new Date(Date.now() - ONLINE_WINDOW_SECONDS * 1000).toISOString();
    const { data: sessions, error: sessionsError } = await supabase
      .from("user_sessions")
      .select("*")
      .is("ended_at", null)
      .gte("last_seen_at", since);

    if (sessionsError) throw sessionsError;

    const sessionsByUser = _.groupBy(sessions || [], "user_id");

    const rows = (users || []).map((user) => {
      const userSessions = (sessionsByUser[user.id] || []).map((session) => ({
        ...session,
        status: sessionStatus(session),
      }));

      // La sesion mas "viva" manda: primero por estado, despues por heartbeat mas reciente.
      const best = _.first(
        _.orderBy(
          userSessions,
          [
            (session) => STATUS_PRIORITY[session.status] || 0,
            (session) => new Date(session.last_seen_at).getTime(),
          ],
          ["desc", "desc"]
        )
      );

      const status = best ? best.status : "offline";

      return {
        ...user,
        status,
        sessions_count: userSessions.filter((s) => s.status !== "offline").length,
        current_path: best ? best.current_path : null,
        session_started_at: best ? best.started_at : null,
        last_seen_at: best ? best.last_seen_at : null,
        last_activity_at: best ? best.last_activity_at : null,
        seconds_since_activity: best ? secondsSince(best.last_activity_at) : null,
        user_agent: best ? best.user_agent : null,
      };
    });

    const ordered = _.orderBy(
      rows,
      [
        (row) => STATUS_PRIORITY[row.status] || 0,
        (row) => (row.last_activity_at ? new Date(row.last_activity_at).getTime() : 0),
        (row) => String(row.name || "").toLowerCase(),
      ],
      ["desc", "desc", "asc"]
    );

    res.json({
      generated_at: new Date().toISOString(),
      thresholds: {
        online_window_seconds: ONLINE_WINDOW_SECONDS,
        idle_after_seconds: IDLE_AFTER_SECONDS,
      },
      summary: {
        activos: ordered.filter((r) => r.status === "activo").length,
        inactivos: ordered.filter((r) => r.status === "inactivo").length,
        offline: ordered.filter((r) => r.status === "offline").length,
        total: ordered.length,
      },
      users: ordered,
    });
  } catch (e) {
    const message = errorMessage(e);
    console.error("presence getPresence", message);
    res.status(500).json({ error: message });
  }
};

module.exports = self;

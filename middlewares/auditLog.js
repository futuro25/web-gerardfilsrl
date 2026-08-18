"use strict";

const supabase = require("../controllers/db");

const ACTION_BY_METHOD = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

// Endpoints que no son escrituras de negocio: presencia (heartbeat cada 45s),
// login y cron. Auditarlos solo agregaria ruido.
const SKIPPED_PREFIXES = [
  "/presence",
  "/cron",
  "/users/login",
  "/users/forgot-password",
];

// Nunca guardamos credenciales ni contenido de archivos en la auditoria.
const REDACTED_KEYS = [
  "password",
  "new_password",
  "current_password",
  "session_token",
  "token",
  "file",
  "files",
  "base64",
  "image_base64",
];

const MAX_PAYLOAD_CHARS = 20000;

// Todos los borrados del sistema son logicos (marcan deleted_at) y trabajan
// sobre la columna id de su propia tabla, asi que el registro afectado sigue
// disponible despues de la operacion y lo podemos copiar a la auditoria.
const TABLE_BY_ENTITY = {
  "account-movements": "account_movements",
  aportes: "aportes",
  cashflow: "cashflow",
  clients: "clients",
  deliveries: "deliveries",
  deliverynotes: "deliverynotes",
  "fixed-expenses": "fixed_expenses",
  invoices: "invoices",
  orders: "orders",
  paychecks: "paychecks",
  "payment-orders": "payment_orders",
  payments: "payments",
  products: "products",
  "retention-certificates": "retention_payments",
  "stock-entries": "stock_entries",
  "supplier-invoices": "supplier_invoices",
  suppliers: "suppliers",
  users: "users",
  veps: "veps",
};

function shouldSkip(path) {
  return SKIPPED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function redact(value, depth = 0) {
  if (value == null || depth > 6) return value;

  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item) => redact(item, depth + 1));
  }

  if (typeof value === "object") {
    const out = {};
    Object.keys(value).forEach((key) => {
      if (REDACTED_KEYS.includes(key.toLowerCase())) {
        out[key] = "[oculto]";
        return;
      }
      out[key] = redact(value[key], depth + 1);
    });
    return out;
  }

  // Cadenas enormes (imagenes en base64, por ejemplo) no aportan a la auditoria.
  if (typeof value === "string" && value.length > 2000) {
    return `[texto de ${value.length} caracteres]`;
  }

  return value;
}

function buildPayload(req) {
  const body = req.body && Object.keys(req.body).length ? redact(req.body) : null;
  const query = req.query && Object.keys(req.query).length ? redact(req.query) : null;

  const payload = {};
  if (body) payload.body = body;
  if (query) payload.query = query;
  if (req.file) payload.file = req.file.originalname;
  if (Array.isArray(req.files)) {
    payload.file = req.files.map((f) => f.originalname).join(", ");
  }

  if (!Object.keys(payload).length) return null;

  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_PAYLOAD_CHARS) {
    return { truncated: true, size: serialized.length };
  }

  return payload;
}

// Las rutas siguen el patron /recurso/:id (y a veces /recurso/:id/sub-recurso),
// asi que la entidad sale del primer segmento y el id del primero numerico.
function parseRoute(path) {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const entity = segments[0] || "desconocido";
  const idSegment = segments.slice(1).find((segment) => /^\d+$/.test(segment));
  return { entity, entity_id: idSegment || null };
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || null;
}

function parseUserId(value) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function extractResponseInfo(body) {
  if (!body || typeof body !== "object") return { id: null, error: null };

  const error =
    typeof body.error === "string"
      ? body.error
      : body.error
        ? JSON.stringify(body.error)
        : null;

  const id = body.id != null ? String(body.id) : null;

  return { id, error };
}

/**
 * Copia el registro afectado. Se ejecuta despues de haber respondido, asi que
 * no le agrega ni un milisegundo a la operacion del usuario.
 */
async function readSnapshot(entry) {
  const table = TABLE_BY_ENTITY[entry.entity];
  if (!table || !entry.entity_id || !entry.ok) return null;

  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", entry.entity_id)
      .maybeSingle();

    if (error || !data) return null;

    return redact(data);
  } catch (e) {
    console.error("audit_log snapshot", e.message);
    return null;
  }
}

function auditLog(req, res, next) {
  const action = ACTION_BY_METHOD[req.method];
  if (!action || shouldSkip(req.path)) return next();

  const { entity, entity_id } = parseRoute(req.path);
  const entry = {
    user_id: parseUserId(req.headers["x-user-id"]),
    username: String(req.headers["x-username"] || "").slice(0, 100) || null,
    action,
    entity,
    entity_id,
    method: req.method,
    path: req.originalUrl.slice(0, 300),
    payload: null,
    entity_snapshot: null,
    ip: getClientIp(req),
    user_agent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
  };

  // Envolvemos res.json para quedarnos con el id del registro creado y con el
  // error que devuelven los controladores (que responden 200 con {error}).
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const { id, error } = extractResponseInfo(body);
    entry.status_code = res.statusCode;
    entry.ok = res.statusCode < 400 && !error;
    entry.error = error ? error.slice(0, 500) : null;
    if (!entry.entity_id && id) entry.entity_id = id;
    return originalJson(body);
  };

  // La auditoria nunca debe romper ni demorar la respuesta al usuario.
  res.on("finish", () => {
    // Recien aca el body esta completo: en los uploads lo llena multer, que
    // corre despues de este middleware.
    entry.payload = buildPayload(req);

    if (entry.status_code == null) {
      entry.status_code = res.statusCode;
      entry.ok = res.statusCode < 400;
    }

    readSnapshot(entry)
      .then((snapshot) => {
        entry.entity_snapshot = snapshot;
        return supabase.from("audit_log").insert(entry);
      })
      .then(({ error }) => {
        if (error) console.error("audit_log insert", error.message || error);
      })
      .catch((e) => console.error("audit_log insert", e.message));
  });

  next();
}

module.exports = auditLog;

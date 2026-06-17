"use strict";

const self = {};
const supabase = require("./db");
const { DateTime } = require("luxon");

const VEP_CATEGORIES = new Set([
  "IIBB",
  "Seguridad e Higiene",
  "Cargas Sociales",
  "IVA",
  "Sindicato",
  "Impuesto a las ganancias",
  "Bienes Personales",
  "Otros",
]);

function normalizeCategory(value) {
  const v = String(value || "").trim();
  return VEP_CATEGORIES.has(v) ? v : null;
}

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeRow(row) {
  if (!row) return row;
  return {
    ...row,
    status: row.paid_at ? "pagado" : "pendiente",
    display_category:
      row.category === "Otros" && row.custom_category
        ? row.custom_category
        : row.category,
  };
}

function validateVepBody(body, { partial = false } = {}) {
  const amount =
    body.amount != null ? parseAmount(body.amount) : partial ? undefined : null;
  const dueDate =
    body.due_date != null ? String(body.due_date || "").trim() : partial ? undefined : "";
  const category =
    body.category != null
      ? normalizeCategory(body.category)
      : partial
        ? undefined
        : null;
  const customCategory = String(body.custom_category || "").trim();

  if (!partial || body.amount != null) {
    if (amount == null) return "El importe debe ser mayor a 0";
  }
  if (!partial || body.due_date != null) {
    if (!dueDate) return "La fecha de vencimiento es obligatoria";
  }
  if (!partial || body.category != null) {
    if (!category) return "Clasificación inválida";
    if (category === "Otros" && !customCategory) {
      return "Indique el tipo de VEP cuando selecciona Otros";
    }
  }

  const row = {};
  if (amount != null) row.amount = amount;
  if (dueDate) row.due_date = dueDate;
  if (category) {
    row.category = category;
    row.custom_category = category === "Otros" ? customCategory : null;
  }

  return row;
}

self.getVeps = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("veps")
      .select("*")
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ data: (data || []).map(normalizeRow) });
  } catch (e) {
    console.error("getVeps error:", e.message);
    res.json({ error: e.message, data: [] });
  }
};

self.getUpcomingVeps = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 15, 1), 90);
    const today = DateTime.now().toISODate();
    const until = DateTime.now().plus({ days }).toISODate();

    const { data, error } = await supabase
      .from("veps")
      .select("*")
      .is("deleted_at", null)
      .is("paid_at", null)
      .gte("due_date", today)
      .lte("due_date", until)
      .order("due_date", { ascending: true });

    if (error) throw error;
    res.json({
      data: (data || []).map(normalizeRow),
      days,
    });
  } catch (e) {
    console.error("getUpcomingVeps error:", e.message);
    res.json({ error: e.message, data: [] });
  }
};

self.createVep = async (req, res) => {
  try {
    const validated = validateVepBody(req.body);
    if (typeof validated === "string") {
      return res.status(400).json({ error: validated });
    }

    const { data, error } = await supabase
      .from("veps")
      .insert(validated)
      .select();
    if (error) throw error;
    res.json(normalizeRow(data?.[0]));
  } catch (e) {
    console.error("createVep error:", e.message);
    res.json({ error: e.message });
  }
};

self.updateVep = async (req, res) => {
  try {
    const id = req.params.id;
    const validated = validateVepBody(req.body, { partial: false });
    if (typeof validated === "string") {
      return res.status(400).json({ error: validated });
    }

    const { data, error } = await supabase
      .from("veps")
      .update(validated)
      .eq("id", id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;
    if (!data?.length) {
      return res.status(404).json({ error: "VEP no encontrado" });
    }
    res.json(normalizeRow(data[0]));
  } catch (e) {
    console.error("updateVep error:", e.message);
    res.json({ error: e.message });
  }
};

self.deleteVep = async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabase
      .from("veps")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    console.error("deleteVep error:", e.message);
    res.json({ error: e.message });
  }
};

self.markVepAsPaid = async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase
      .from("veps")
      .update({ paid_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .is("paid_at", null)
      .select();

    if (error) throw error;
    if (!data?.length) {
      return res.status(404).json({ error: "VEP no encontrado o ya pagado" });
    }
    res.json(normalizeRow(data[0]));
  } catch (e) {
    console.error("markVepAsPaid error:", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;

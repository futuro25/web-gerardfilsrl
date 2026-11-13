"use strict";

const self = {};
const supabase = require("./db");
const r2 = require("../services/r2");

// Gastos con tarjeta de crédito: no participan de los movimientos de Control.

function monthRange(month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!m || !y || m < 1 || m > 12) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return { from: `${y}-${pad(m)}-01`, to: `${nextY}-${pad(nextM)}-01` };
}

// Solo borramos archivos de esta sección, por si alguna fila apuntara a otro lado.
const FILE_PREFIX = "tarjeta-credito/";

async function getCurrentImageKey(id) {
  const { data, error } = await supabase
    .from("credit_card_expenses")
    .select("image_key")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data?.image_key || null;
}

// Borrado del archivo en R2. Si falla no frena la operación: el registro ya
// quedó actualizado y, como mucho, queda un archivo huérfano en el bucket.
async function removeFile(key) {
  if (!key || !key.startsWith(FILE_PREFIX)) return;
  try {
    await r2.deleteObject(key);
  } catch (e) {
    console.error("credit card file delete error:", key, e.message);
  }
}

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanText(value) {
  const v = String(value ?? "").trim();
  return v || null;
}

self.getCreditCardExpenses = async (req, res) => {
  try {
    let query = supabase
      .from("credit_card_expenses")
      .select("*")
      .is("deleted_at", null);

    const range = monthRange(req.query.month, req.query.year);
    if (range) query = query.gte("date", range.from).lt("date", range.to);

    const search = cleanText(req.query.search);
    if (search) {
      const term = search.replace(/[%_,()]/g, " ");
      query = query.ilike("description", `%${term}%`);
    }

    const { data, error } = await query
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (e) {
    console.error("getCreditCardExpenses error:", e.message);
    res.json({ error: e.message, data: [] });
  }
};

self.createCreditCardExpense = async (req, res) => {
  try {
    const description = cleanText(req.body.description);
    const amount = parseAmount(req.body.amount);
    if (!description || !req.body.date || amount == null) {
      return res.status(400).json({ error: "Fecha, descripción e importe son obligatorios" });
    }

    const row = {
      date: req.body.date,
      description,
      amount,
      image_key: cleanText(req.body.image_key),
    };

    const { data, error } = await supabase
      .from("credit_card_expenses")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("createCreditCardExpense error:", e.message);
    res.json({ error: e.message });
  }
};

self.updateCreditCardExpense = async (req, res) => {
  try {
    const id = req.params.id;
    const description = cleanText(req.body.description);
    const amount = parseAmount(req.body.amount);
    if (!description || !req.body.date || amount == null) {
      return res.status(400).json({ error: "Fecha, descripción e importe son obligatorios" });
    }

    const update = {
      date: req.body.date,
      description,
      amount,
      updated_at: new Date(),
    };
    // Solo se pisa el archivo si viene uno nuevo en el body.
    let previousKey = null;
    if (req.body.image_key !== undefined) {
      update.image_key = cleanText(req.body.image_key);
      previousKey = await getCurrentImageKey(id);
    }

    const { data, error } = await supabase
      .from("credit_card_expenses")
      .update(update)
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) throw error;
    if (previousKey && previousKey !== update.image_key) await removeFile(previousKey);
    res.json(data);
  } catch (e) {
    console.error("updateCreditCardExpense error:", e.message);
    res.json({ error: e.message });
  }
};

self.setCreditCardExpenseImage = async (req, res) => {
  try {
    const id = req.params.id;
    const imageKey = cleanText(req.body.image_key);
    if (!imageKey) {
      return res.status(400).json({ error: "Falta el archivo" });
    }
    const previousKey = await getCurrentImageKey(id);

    const { data, error } = await supabase
      .from("credit_card_expenses")
      .update({ image_key: imageKey, updated_at: new Date() })
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) throw error;
    if (previousKey && previousKey !== imageKey) await removeFile(previousKey);
    res.json(data);
  } catch (e) {
    console.error("setCreditCardExpenseImage error:", e.message);
    res.json({ error: e.message });
  }
};

self.deleteCreditCardExpense = async (req, res) => {
  try {
    const id = req.params.id;
    const imageKey = await getCurrentImageKey(id);
    // Se limpia image_key porque el archivo deja de existir en R2.
    const { error } = await supabase
      .from("credit_card_expenses")
      .update({ deleted_at: new Date(), image_key: null })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw error;
    await removeFile(imageKey);
    res.json({ success: true, id });
  } catch (e) {
    console.error("deleteCreditCardExpense error:", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;

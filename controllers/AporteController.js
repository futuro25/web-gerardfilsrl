"use strict";

const self = {};
const supabase = require("./db");

const CONTRIBUTORS = new Set(["Carolina", "Jose Maria", "Walter"]);

function normalizeContributor(value) {
  const v = String(value || "").trim();
  return CONTRIBUTORS.has(v) ? v : null;
}

self.getAportes = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("aportes")
      .select("*")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (e) {
    console.error("getAportes error:", e.message);
    res.json({ error: e.message, data: [] });
  }
};

self.createAporte = async (req, res) => {
  try {
    const contributor = normalizeContributor(req.body.contributor);
    if (!contributor) {
      return res.status(400).json({ error: "Contribuyente inválido" });
    }
    if (!req.body.date || req.body.amount == null) {
      return res.status(400).json({ error: "Fecha y monto son obligatorios" });
    }

    const row = {
      date: req.body.date,
      amount: parseFloat(req.body.amount),
      contributor,
    };

    const { data, error } = await supabase.from("aportes").insert(row).select();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("createAporte error:", e.message);
    res.json({ error: e.message });
  }
};

self.updateAporte = async (req, res) => {
  try {
    const id = req.params.id;
    const contributor = normalizeContributor(req.body.contributor);
    if (!contributor) {
      return res.status(400).json({ error: "Contribuyente inválido" });
    }

    const update = {
      date: req.body.date,
      amount: parseFloat(req.body.amount),
      contributor,
    };

    const { data, error } = await supabase.from("aportes").update(update).eq("id", id).is("deleted_at", null).select();

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("updateAporte error:", e.message);
    res.json({ error: e.message });
  }
};

self.deleteAporte = async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabase.from("aportes").update({ deleted_at: new Date() }).eq("id", id).is("deleted_at", null);

    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    console.error("deleteAporte error:", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;

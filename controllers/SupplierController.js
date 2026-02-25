"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getSuppliers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .is("deleted_at", null);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getSupplierById = async (req, res) => {
  const supplier_id = req.params.supplier_id;
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplier_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getSupplierBySupplierName = async (req, res) => {
  const search = req.params.fantasy_name;
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .is("deleted_at", null)
      .ilike("fantasy_name", `%${search}%`);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getSupplierByEmail = async (req, res) => {
  const search = req.params.email;
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .is("deleted_at", null)
      .ilike("email", `%${search}%`);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createSupplier = async (req, res) => {
  try {
    const supplier = {
      name: req.body.name,
      last_name: req.body.last_name,
      fantasy_name: req.body.fantasy_name,
      email: req.body.email,
      phone: req.body.phone,
      service: req.body.service,
      industry: req.body.industry,
      category: req.body.category,
      cuit: req.body.cuit,
      tax_regime: req.body.tax_regime,
      street: req.body.street,
      street_number: req.body.street_number,
      city: req.body.city,
      zip_code: req.body.zip_code,
      clasificacion: req.body.clasificacion,
      alias: req.body.alias,
      cbu: req.body.cbu,
      horario: req.body.horario,
    };

    const { data: newSupplier, error } = await supabase
      .from("suppliers")
      .insert(supplier)
      .select();

    return res.json(newSupplier);
  } catch (e) {
    console.log("Supplier creation error", e.message);
    return res.json(e);
  }
};

self.getSupplierByIdAndUpdate = async (req, res) => {
  try {
    const supplier_id = req.params.supplier_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const { data: updatedSupplier, error } = await supabase
      .from("suppliers")
      .update(update)
      .eq("id", supplier_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedSupplier);
  } catch (e) {
    console.error("delete supplier by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteSupplierById = async (req, res) => {
  try {
    const supplier_id = req.params.supplier_id;
    const update = { deleted_at: new Date() };
    const { data: updatedSupplier, error } = await supabase
      .from("suppliers")
      .update(update)
      .eq("id", supplier_id);

    res.json(updatedSupplier);
  } catch (e) {
    console.error("delete supplier by id", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;

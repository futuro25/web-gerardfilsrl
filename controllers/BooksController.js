"use strict";

const self = {};
const supabase = require("./db");
const { DateTime } = require("luxon");

const _ = require("lodash");

self.getVentasComprobantes = async (req, res) => {
  try {
    const { data: cashflows, error: cashflowsError } = await supabase
      .from("cashflow")
      .select("*, taxes(*)")
      .like("type", "INGRESO")
      .order("date", { ascending: false });

    if (cashflowsError) throw cashflowsError;

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("*");

    if (clientsError) throw clientsError;

    const cashflowsWithSuppliers = cashflows.map((cf) => {
      const client = clients.find((s) => s.id === +cf.provider);
      return {
        ...cf,
        client: client || {},
      };
    });

    res.json(cashflowsWithSuppliers);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getComprasComprobantes = async (req, res) => {
  try {
    const { data: cashflows, error: cashflowsError } = await supabase
      .from("cashflow")
      .select("*, taxes(*)")
      .like("type", "EGRESO")
      .order("date", { ascending: false });

    if (cashflowsError) throw cashflowsError;

    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("*");

    if (suppliersError) throw suppliersError;

    const cashflowsWithSuppliers = cashflows.map((cf) => {
      const supplier = suppliers.find((s) => s.id === +cf.provider);
      return {
        ...cf,
        supplier: supplier || {},
      };
    });

    res.json(cashflowsWithSuppliers);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getComprasAlicuotas = async (req, res) => {};

self.getVentasAlicuotas = async (req, res) => {};

module.exports = self;

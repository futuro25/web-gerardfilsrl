"use strict";

const self = {};
const supabase = require("./db");
const {
  buildComprasComprobantes,
  buildVentasComprobantes,
} = require("../services/fiscalBooksData");

self.getVentasComprobantes = async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await buildVentasComprobantes(from, to);
    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getComprasComprobantes = async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await buildComprasComprobantes(from, to);
    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getComprasAlicuotas = async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await buildComprasComprobantes(from, to);
    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getVentasAlicuotas = async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await buildVentasComprobantes(from, to);
    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

module.exports = self;

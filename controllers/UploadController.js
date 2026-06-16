"use strict";

const r2 = require("../services/r2");

const self = {};

self.uploadInvoiceImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo" });
    }

    const key = await r2.uploadBuffer({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
      prefix: "facturas-compras/",
    });

    return res.status(201).json({
      key,
      content_type: req.file.mimetype,
      original_name: req.file.originalname,
    });
  } catch (e) {
    console.error("uploadInvoiceImage error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};

self.uploadDeliveryDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo" });
    }

    const key = await r2.uploadBuffer({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
      prefix: "facturas-ventas/",
    });

    return res.status(201).json({
      key,
      content_type: req.file.mimetype,
      original_name: req.file.originalname,
    });
  } catch (e) {
    console.error("uploadDeliveryDocument error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};

self.getInvoiceImageUrl = async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) {
      return res.status(400).json({ error: "Falta el parámetro 'key'" });
    }
    const url = await r2.getPresignedGetUrl(key, 3600);
    return res.json({ url });
  } catch (e) {
    console.error("getInvoiceImageUrl error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};

module.exports = self;

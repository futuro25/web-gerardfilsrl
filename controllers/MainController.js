"use strict";

const self = {};

const _ = require("lodash");

self.getMain = async (req, res) => {
  try {
    res.json({ status: "ok" });
  } catch (e) {
    res.json({ error: e.message });
  }
};


self.getMore = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users") // nombre de la tabla
      .select("*")      // columnas a seleccionar

    if (error) throw error;

    res.json({ status: "ok", data });
  } catch (e) {
    res.json({ error: e.message });
  }
};

module.exports = self;

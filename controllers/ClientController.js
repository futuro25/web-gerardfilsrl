"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getClients = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .is("deleted_at", null)
      .order("id", { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getClientById = async (req, res) => {
  const client_id = req.params.client_id;
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getClientByClientName = async (req, res) => {
  const search = req.params.fantasy_name;
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .is("deleted_at", null)
      .ilike("fantasy_name", `%${search}%`);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getClientByEmail = async (req, res) => {
  const search = req.params.email;
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .is("deleted_at", null)
      .ilike("email", `%${search}%`);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createClient = async (req, res) => {
  try {
    const client = {
      name: req.body.name,
      last_name: req.body.last_name,
      fantasy_name: req.body.fantasy_name,
      email: req.body.email,
      phone: req.body.phone,
      document_number: req.body.document_number,
      document_type: req.body.document_type,
    };

    const { data: newClient, error } = await supabase
      .from("clients")
      .insert(client)
      .select();

    return res.json(newClient);
  } catch (e) {
    console.log("Client creation error", e.message);
    return res.json(e);
  }
};

self.getClientByIdAndUpdate = async (req, res) => {
  try {
    const client_id = req.params.client_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const { data: updatedClient, error } = await supabase
      .from("clients")
      .update(update)
      .eq("id", client_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedClient);
  } catch (e) {
    console.error("delete client by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteClientById = async (req, res) => {
  try {
    const client_id = req.params.client_id;
    const update = { deleted_at: new Date() };
    const { data: updatedClient, error } = await supabase
      .from("clients")
      .update(update)
      .eq("id", client_id);

    res.json(updatedClient);
  } catch (e) {
    console.error("delete client by id", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;

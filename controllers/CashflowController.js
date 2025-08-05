"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getCashflows = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cashflow")
      .select("*")
      .is("deleted_at", null)
      .order("date", { ascending: false });

    const { data: suppliers, error: supplierError } = await supabase
      .from("suppliers")
      .select("*")
      .is("deleted_at", null);
    
    const { data: clients, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .is("deleted_at", null);

    let movements = [];
    
    data.map(movement => {
      movements.push({
        ...movement,
        provider_name: movement.type === 'EGRESO' ? getSupplierName(movement.provider, suppliers) : getClientName(movement.provider, clients),
      })
    })

    if (error || supplierError || clientError) throw error;

    res.json(movements);
  } catch (e) {
    console.log(e)
    res.json({ error: e?.message || 'Error' });
  }
};

self.getCashflowById = async (req, res) => {
  const cashflow_id = req.params.cashflow_id;
  try {
    const { data, error } = await supabase
      .from("cashflow")
      .select("*")
      .eq("id", cashflow_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createCashflow = async (req, res) => {
  try {
    const cashflow = {
      type: req.body.type,
      category: req.body.category,
      net_amount: req.body.net_amount,
      amount: req.body.amount,
      date: req.body.date,
      description: req.body.description,
      provider: req.body.provider,
      reference: req.body.reference,
      payment_method: req.body.payment_method || "EFECTIVO",
    };

    const { data: newCashflow, error } = await supabase
      .from("cashflow")
      .insert(cashflow)
      .select();

    if (error) throw error;

    let newInvoiceTaxes = [];

    if (newCashflow?.length && Array.isArray(req.body.taxes)) {
      const taxes = req.body.taxes;

      const invoiceTaxes = taxes.map((tax) => ({
        invoice_id: newCashflow[0].id,
        name: tax.type,
        amount: parseFloat(tax.value),
      }));

      const { data, error: taxesError } = await supabase
        .from("taxes")
        .insert(invoiceTaxes);

      console.log("taxes", invoiceTaxes);
      if (taxesError) {
        console.error("Error creando impuestos de factura:", taxesError);
        return res
          .status(500)
          .json({ error: "Error al insertar los impuestos" });
      }

      newInvoiceTaxes = data;
    }

    return res.json(newCashflow);
  } catch (e) {
    console.log("Cashflow creation error", e.message);
    return res.json({ error: e.message });
  }
};

self.updateCashflowById = async (req, res) => {
  try {
    const cashflow_id = req.params.cashflow_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const { data: updatedCashflow, error } = await supabase
      .from("cashflow")
      .update(update)
      .eq("id", cashflow_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedCashflow);
  } catch (e) {
    console.error("update cashflow by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteCashflowById = async (req, res) => {
  try {
    const cashflow_id = req.params.cashflow_id;
    const update = { deleted_at: new Date() };
    const { data: deletedCashflow, error } = await supabase
      .from("cashflow")
      .update(update)
      .eq("id", cashflow_id);

    if (error) throw error;

    res.json(deletedCashflow);
  } catch (e) {
    console.error("delete cashflow by id", e.message);
    res.json({ error: e.message });
  }
};


function getSupplierName (id, suppliers) {
  const supplier = suppliers?.find((s) => {
    if (s.id === +id) {
      return s;
    }
  });
  return supplier ? supplier.fantasy_name : "Proveedor no encontrado";
};

function getClientName (id, clients) {
  const client = clients?.find((s) => {
    if (s.id === +id) {
      return s;
    }
  });
  return client ? client.fantasy_name : "Cliente no encontrado";
};

module.exports = self;

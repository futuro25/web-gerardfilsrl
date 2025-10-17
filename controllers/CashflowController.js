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

    // Extract taxes from the update object
    const taxes = update.taxes;
    delete update.taxes; // Remove taxes from the main update

    const { data: updatedCashflow, error } = await supabase
      .from("cashflow")
      .update(update)
      .eq("id", cashflow_id)
      .is("deleted_at", null);

    if (error) throw error;

    // Handle taxes update if provided
    if (taxes && Array.isArray(taxes)) {
      // First, delete existing taxes (hard delete)
      const { error: deleteTaxesError } = await supabase
        .from("taxes")
        .delete()
        .eq("invoice_id", cashflow_id);

      if (deleteTaxesError) {
        console.error("Error eliminando impuestos existentes:", deleteTaxesError);
      }

      // Then, insert new taxes
      const invoiceTaxes = taxes.map((tax) => ({
        invoice_id: cashflow_id,
        name: tax.type,
        amount: parseFloat(tax.value),
      }));

      const { data: newTaxes, error: taxesError } = await supabase
        .from("taxes")
        .insert(invoiceTaxes);

      if (taxesError) {
        console.error("Error actualizando impuestos:", taxesError);
        return res.status(500).json({ error: "Error al actualizar los impuestos" });
      }

      console.log(`Actualizados ${newTaxes?.length || 0} impuestos para el movimiento ${cashflow_id}`);
    }

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
    
    // Soft delete the cashflow movement
    const { data: deletedCashflow, error } = await supabase
      .from("cashflow")
      .update(update)
      .eq("id", cashflow_id);

    if (error) throw error;

    // Also delete related taxes (hard delete)
    const { data: deletedTaxes, error: taxesError } = await supabase
      .from("taxes")
      .delete()
      .eq("invoice_id", cashflow_id);

    if (taxesError) {
      console.error("Error eliminando impuestos relacionados:", taxesError);
      // Don't fail the entire operation if taxes deletion fails
    } else {
      console.log(`Eliminados ${deletedTaxes?.length || 0} impuestos relacionados al movimiento ${cashflow_id}`);
    }

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

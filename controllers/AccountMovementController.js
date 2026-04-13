"use strict";

const self = {};
const supabase = require("./db");
const { DateTime } = require("luxon");

self.getMovements = async (req, res) => {
  try {
    const { month, year, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from("account_movements")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    if (month && year) {
      const startDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).toISODate();
      const endDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).endOf("month").toISODate();
      query = query.gte("date", startDate).lte("date", endDate);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({ data, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    console.error("getMovements error:", e.message);
    res.json({ error: e.message });
  }
};

self.getSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const today = DateTime.now().toISODate();

    // Current balance: all movements with effective date <= today
    const { data: allMovements, error: allError } = await supabase
      .from("account_movements")
      .select("type, amount, is_cheque, cheque_due_date, date")
      .is("deleted_at", null);

    if (allError) throw allError;

    let balanceWithoutCheques = 0;
    let balanceWithCheques = 0;
    allMovements.forEach((m) => {
      const amount = m.type === "INGRESO" ? parseFloat(m.amount) : -parseFloat(m.amount);
      balanceWithCheques += amount;
      if (!m.is_cheque || !m.cheque_due_date || m.cheque_due_date <= today) {
        balanceWithoutCheques += amount;
      }
    });

    // Monthly totals
    let monthlyIncome = 0;
    let monthlyExpense = 0;

    if (month && year) {
      const startDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).toISODate();
      const endDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).endOf("month").toISODate();

      allMovements.forEach((m) => {
        const effectiveDate = m.is_cheque && m.cheque_due_date ? m.cheque_due_date : m.date;
        if (effectiveDate >= startDate && effectiveDate <= endDate) {
          if (m.type === "INGRESO") {
            monthlyIncome += parseFloat(m.amount);
          } else {
            monthlyExpense += parseFloat(m.amount);
          }
        }
      });
    }

    res.json({
      balanceWithoutCheques,
      balanceWithCheques,
      monthlyIncome,
      monthlyExpense,
    });
  } catch (e) {
    console.error("getSummary error:", e.message);
    res.json({ error: e.message });
  }
};

self.getUpcomingCheques = async (req, res) => {
  try {
    const today = DateTime.now().toISODate();
    const in30Days = DateTime.now().plus({ days: 30 }).toISODate();

    const { data, error } = await supabase
      .from("account_movements")
      .select("*")
      .eq("is_cheque", true)
      .is("deleted_at", null)
      .gte("cheque_due_date", today)
      .lte("cheque_due_date", in30Days)
      .order("cheque_due_date", { ascending: true });

    if (error) throw error;

    const toExpire = data.filter((m) => m.type === "EGRESO");
    const toCredit = data.filter((m) => m.type === "INGRESO");

    res.json({ toExpire, toCredit });
  } catch (e) {
    console.error("getUpcomingCheques error:", e.message);
    res.json({ error: e.message });
  }
};

self.createMovement = async (req, res) => {
  try {
    const movement = {
      type: req.body.type,
      responsible: req.body.responsible,
      date: req.body.date,
      amount: req.body.amount,
      description: req.body.description || null,
      is_cheque: req.body.is_cheque || false,
      cheque_number: req.body.cheque_number || null,
      cheque_bank: req.body.cheque_bank || null,
      cheque_due_date: req.body.cheque_due_date || null,
    };

    // For cheques, use cheque_due_date as the movement date for ordering
    if (movement.is_cheque && movement.cheque_due_date) {
      movement.date = movement.cheque_due_date;
    }

    let paycheckId = null;

    // If it's an egreso cheque, also create in paychecks table
    if (movement.is_cheque && movement.type === "EGRESO") {
      const paycheck = {
        number: movement.cheque_number,
        bank: movement.cheque_bank,
        amount: movement.amount,
        due_date: movement.cheque_due_date,
        type: "OUT",
      };

      const { data: newPaycheck, error: paycheckError } = await supabase
        .from("paychecks")
        .insert(paycheck)
        .select();

      if (paycheckError) {
        console.error("Error creating paycheck:", paycheckError);
        throw paycheckError;
      }

      if (newPaycheck && newPaycheck.length > 0) {
        paycheckId = newPaycheck[0].id;
      }
    }

    movement.paycheck_id = paycheckId;

    const { data: newMovement, error } = await supabase
      .from("account_movements")
      .insert(movement)
      .select();

    if (error) {
      // Rollback paycheck if movement insert fails
      if (paycheckId) {
        await supabase
          .from("paychecks")
          .update({ deleted_at: new Date() })
          .eq("id", paycheckId);
      }
      throw error;
    }

    return res.json(newMovement);
  } catch (e) {
    console.error("createMovement error:", e.message);
    return res.json({ error: e.message });
  }
};

self.updateMovement = async (req, res) => {
  try {
    const movementId = req.params.id;

    const { data: existing, error: fetchError } = await supabase
      .from("account_movements")
      .select("*")
      .eq("id", movementId)
      .is("deleted_at", null)
      .single();

    if (fetchError) throw fetchError;

    const update = {
      type: req.body.type,
      responsible: req.body.responsible,
      date: req.body.date,
      amount: req.body.amount,
      description: req.body.description || null,
      is_cheque: req.body.is_cheque || false,
      cheque_number: req.body.cheque_number || null,
      cheque_bank: req.body.cheque_bank || null,
      cheque_due_date: req.body.cheque_due_date || null,
    };

    if (update.is_cheque && update.cheque_due_date) {
      update.date = update.cheque_due_date;
    }

    // Handle paycheck sync for cheque egresos
    if (existing.paycheck_id) {
      if (update.is_cheque && update.type === "EGRESO") {
        await supabase
          .from("paychecks")
          .update({
            number: update.cheque_number,
            bank: update.cheque_bank,
            amount: update.amount,
            due_date: update.cheque_due_date,
          })
          .eq("id", existing.paycheck_id);
      } else {
        await supabase
          .from("paychecks")
          .update({ deleted_at: new Date() })
          .eq("id", existing.paycheck_id);
        update.paycheck_id = null;
      }
    } else if (update.is_cheque && update.type === "EGRESO") {
      const { data: newPaycheck, error: paycheckError } = await supabase
        .from("paychecks")
        .insert({
          number: update.cheque_number,
          bank: update.cheque_bank,
          amount: update.amount,
          due_date: update.cheque_due_date,
          type: "OUT",
        })
        .select();

      if (paycheckError) throw paycheckError;
      if (newPaycheck?.length > 0) {
        update.paycheck_id = newPaycheck[0].id;
      }
    }

    const { data: updated, error } = await supabase
      .from("account_movements")
      .update(update)
      .eq("id", movementId)
      .select();

    if (error) throw error;

    res.json(updated);
  } catch (e) {
    console.error("updateMovement error:", e.message);
    res.json({ error: e.message });
  }
};

self.deleteMovement = async (req, res) => {
  try {
    const movementId = req.params.id;

    // Get the movement first to check for paycheck_id
    const { data: movement, error: fetchError } = await supabase
      .from("account_movements")
      .select("*")
      .eq("id", movementId)
      .is("deleted_at", null)
      .single();

    if (fetchError) throw fetchError;

    // Soft delete the movement
    const { error } = await supabase
      .from("account_movements")
      .update({ deleted_at: new Date() })
      .eq("id", movementId);

    if (error) throw error;

    // If it has a linked paycheck, soft delete that too
    if (movement.paycheck_id) {
      const { error: paycheckError } = await supabase
        .from("paychecks")
        .update({ deleted_at: new Date() })
        .eq("id", movement.paycheck_id);

      if (paycheckError) {
        console.error("Error deleting linked paycheck:", paycheckError);
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error("deleteMovement error:", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;

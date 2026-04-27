"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

function normalizeRenglonDb(v) {
  const s = String(v ?? "").replace(/\D/g, "").slice(0, 5);
  return s || null;
}

self.getStockEntries = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("stock_entries")
      .select(
        `
        *,
        suppliers(fantasy_name, name, last_name),
        stock_entries_products(*, products(code, name))
      `
      )
      .is("deleted_at", null)
      .order("entry_date", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getStockEntryById = async (req, res) => {
  const stock_entry_id = req.params.stock_entry_id;
  try {
    const { data, error } = await supabase
      .from("stock_entries")
      .select("*")
      .eq("id", stock_entry_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createStockEntry = async (req, res) => {
  try {
    const stockEntry = {
      supplier_id: req.body.supplier_id || null,
      remito_number: req.body.remito_number || null,
      entry_date: req.body.entry_date,
      description: req.body.description || null,
    };

    const { data: newStockEntry, error } = await supabase
      .from("stock_entries")
      .insert(stockEntry)
      .select();

    if (error) {
      return res.json({ error: error.message });
    }

    // Create stock entry products
    const stockEntryProducts = req.body.products.map((product) => ({
      stock_entry_id: newStockEntry[0].id,
      product_id: product.product_id || null,
      quantity: product.quantity,
      color: product.color || null,
      genre: product.genre || null,
      sleeve: product.sleeve || null,
      neck: product.neck || null,
      fuerza: product.fuerza || null,
      talle: product.talle || null,
      producto_tipo: product.producto_tipo || null,
      cuello: product.cuello || null,
      renglon: normalizeRenglonDb(product.renglon),
      codigo: (product.codigo && String(product.codigo).trim()) || null,
    }));

    const { data: newStockEntryProducts, error: errorProducts } = await supabase
      .from("stock_entries_products")
      .insert(stockEntryProducts);

    if (errorProducts) {
      // Reverse the stock entry creation
      const { data: deletedStockEntry, error: deleteError } = await supabase
        .from("stock_entries")
        .delete()
        .eq("id", newStockEntry[0].id);

      return res.json({ error: errorProducts.message });
    }

    // Update product stock only for products with valid product_id (legacy mode)
    const productsWithId = req.body.products.filter(
      (p) => p.product_id && p.product_id !== null && p.product_id !== ""
    );
    
    if (productsWithId.length > 0) {
      try {
        const productsForStock = productsWithId.map((product) => ({
          id: product.product_id,
          quantity: product.quantity,
        }));
        await increaseProductStock(productsForStock);
      } catch (stockError) {
        console.log("Error updating stock (non-critical):", stockError.message);
      }
    }

    return res.json(newStockEntry);
  } catch (e) {
    console.log("Stock entry creation error", e.message);
    return res.json({ error: e.message });
  }
};

/**
 * Ajusta el stock en `products` (modo legacy con product_id). delta negativo = egreso.
 */
const applyDeltaToProductStock = async (productId, delta) => {
  if (!productId || !delta) return;
  const { data: productData, error: getProductError } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .is("deleted_at", null)
    .single();

  if (getProductError || !productData) {
    console.error(`Error al obtener producto ${productId}:`, getProductError);
    return;
  }

  const newStock = Math.max(0, (productData.stock || 0) + delta);
  const { error: updateError } = await supabase
    .from("products")
    .update({ stock: newStock })
    .eq("id", productId);

  if (updateError) {
    console.error(`Error al ajustar stock del producto ${productId}:`, updateError);
  }
};

self.getStockEntryByIdAndUpdate = async (req, res) => {
  try {
    const stock_entry_id = req.params.stock_entry_id;
    const body = { ...req.body };
    if (body.id) delete body.id;

    const { data: existing, error: existErr } = await supabase
      .from("stock_entries")
      .select("id")
      .eq("id", stock_entry_id)
      .is("deleted_at", null)
      .single();

    if (existErr || !existing) {
      return res.json({ error: "Entrada de stock no encontrada" });
    }

    if (Object.prototype.hasOwnProperty.call(body, "products")) {
      if (!Array.isArray(body.products) || body.products.length === 0) {
        return res.json({ error: "Debe indicar al menos un producto en la carga" });
      }
    }

    const allowed = ["supplier_id", "remito_number", "entry_date", "description"];
    const patch = {};
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        if (k === "supplier_id") {
          patch[k] = body[k] === undefined || body[k] === "" ? null : body[k];
        } else if (k === "remito_number") {
          const v = body[k];
          patch[k] = v == null || String(v).trim() === "" ? null : String(v).trim();
        } else if (k === "description") {
          const v = body[k];
          patch[k] = v == null || String(v).trim() === "" ? null : String(v);
        } else {
          patch[k] = body[k];
        }
      }
    }

    const hasHeaderUpdate = Object.keys(patch).length > 0;
    const hasProducts = Array.isArray(body.products) && body.products.length > 0;

    if (!hasHeaderUpdate && !hasProducts) {
      return res.json({ error: "Nada para actualizar" });
    }

    if (hasHeaderUpdate) {
      const { error: heErr } = await supabase
        .from("stock_entries")
        .update(patch)
        .eq("id", stock_entry_id)
        .is("deleted_at", null);
      if (heErr) throw heErr;
    }

    if (hasProducts) {
      for (const product of body.products) {
        const q = parseInt(product.quantity, 10);
        if (!q || q < 1) {
          return res.json({ error: "Cada producto debe tener cantidad válida mayor a cero" });
        }
      }

      const { data: oldLines, error: oldErr } = await supabase
        .from("stock_entries_products")
        .select("*")
        .eq("stock_entry_id", stock_entry_id);
      if (oldErr) throw oldErr;

      for (const old of oldLines || []) {
        if (old.product_id) {
          await applyDeltaToProductStock(old.product_id, -Math.abs(old.quantity || 0));
        }
      }

      const { error: delErr } = await supabase
        .from("stock_entries_products")
        .delete()
        .eq("stock_entry_id", stock_entry_id);
      if (delErr) throw delErr;

      const stockEntryProducts = body.products.map((product) => {
        const qty = parseInt(product.quantity, 10);
        return {
          stock_entry_id: stock_entry_id,
          product_id: product.product_id || null,
          quantity: qty,
          color: product.color || null,
          genre: product.genre || null,
          sleeve: product.sleeve || null,
          neck: product.neck || null,
          fuerza: product.fuerza || null,
          talle: product.talle || null,
          producto_tipo: product.producto_tipo || null,
          cuello: product.cuello || null,
          renglon: normalizeRenglonDb(product.renglon),
          codigo: (product.codigo && String(product.codigo).trim()) || null,
        };
      });

      const { error: insErr } = await supabase
        .from("stock_entries_products")
        .insert(stockEntryProducts);
      if (insErr) throw new Error(insErr.message);

      const withPid = body.products.filter(
        (p) => p.product_id && p.product_id !== null && p.product_id !== ""
      );
      if (withPid.length > 0) {
        try {
          await increaseProductStock(
            withPid.map((product) => ({
              id: product.product_id,
              quantity: parseInt(product.quantity, 10),
            }))
          );
        } catch (stockError) {
          console.log("Error al actualizar stock (legacy product_id, no crítico):", stockError.message);
        }
      }
    }

    const { data: updatedStockEntry, error: finalErr } = await supabase
      .from("stock_entries")
      .select(
        "*, suppliers(fantasy_name, name, last_name), stock_entries_products(*, products(code, name))"
      )
      .eq("id", stock_entry_id)
      .is("deleted_at", null)
      .single();

    if (finalErr) throw finalErr;

    res.json(updatedStockEntry);
  } catch (e) {
    console.error("update stock entry by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteStockEntryById = async (req, res) => {
  try {
    const stock_entry_id = req.params.stock_entry_id;

    // Get stock entry products before deleting
    const { data: stockEntry, error: getError } = await supabase
      .from("stock_entries")
      .select(
        `
        *,
        stock_entries_products(product_id, quantity)
      `
      )
      .eq("id", stock_entry_id)
      .is("deleted_at", null)
      .single();

    if (getError || !stockEntry) {
      return res.json({ error: "Entrada de stock no encontrada" });
    }

    // Restore stock only for products with product_id (legacy mode)
    const productsWithId = stockEntry.stock_entries_products.filter(
      (sep) => sep.product_id
    );

    if (productsWithId.length > 0) {
      const restoreStockPromises = productsWithId.map(async (sep) => {
        const { data: productData, error: getProductError } = await supabase
          .from("products")
          .select("stock")
          .eq("id", sep.product_id)
          .is("deleted_at", null)
          .single();

        if (getProductError || !productData) {
          console.error(
            `Error al obtener producto ${sep.product_id}:`,
            getProductError
          );
          return;
        }

        const newStock = Math.max(0, productData.stock - sep.quantity);
        console.log(
          `Restaurando stock del producto ${sep.product_id}: ${productData.stock} - ${sep.quantity} = ${newStock}`
        );

        const { error: updateError } = await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", sep.product_id);

        if (updateError) {
          console.error(
            `Error al restaurar stock del producto ${sep.product_id}:`,
            updateError
          );
        }
      });

      await Promise.all(restoreStockPromises);
    }

    // Soft delete the stock entry
    const update = { deleted_at: new Date() };
    const { data: updatedStockEntry, error: updateError } = await supabase
      .from("stock_entries")
      .update(update)
      .eq("id", stock_entry_id);

    if (updateError) {
      return res.json({ error: updateError.message });
    }

    res.json(updatedStockEntry);
  } catch (e) {
    console.error("delete stock entry by id", e.message);
    res.json({ error: e.message });
  }
};

// Helper function to increase product stock (opposite of updateProductStock in DeliveryNoteController)
const increaseProductStock = async (products) => {
  try {
    const updateStockPromises = products.map(async (product) => {
      const { data: productData, error: getProductError } = await supabase
        .from("products")
        .select("stock")
        .eq("id", product.id)
        .is("deleted_at", null)
        .single();

      if (getProductError || !productData) {
        console.error(
          `Error al obtener stock del producto ${product.id}:`,
          getProductError
        );
        throw new Error(
          `Producto no encontrado o error al obtener stock para el producto ${product.id}`
        );
      }

      const currentStock = productData.stock || 0;
      const newStock = currentStock + product.quantity;
      console.log(
        `Actualizando stock del producto ${product.id}: Stock actual = ${currentStock}, Cantidad agregada = ${product.quantity}, Nuevo stock = ${newStock}`
      );

      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", product.id);

      if (updateError) {
        console.error(
          `Error al actualizar el stock del producto ${product.id}:`,
          updateError
        );
        throw new Error(
          `Error al actualizar stock para el producto ${product.id}`
        );
      }

      console.log(
        `Stock actualizado para el producto ${product.id}: Nuevo stock = ${newStock}`
      );
      return { id: product.id, newStock };
    });

    const updatedProducts = await Promise.all(updateStockPromises);
    console.log("Productos actualizados correctamente:", updatedProducts);
    return updatedProducts;
  } catch (error) {
    console.error("Hubo un error al actualizar el stock:", error);
    throw new Error("Error al actualizar el stock de los productos");
  }
};

module.exports = self;


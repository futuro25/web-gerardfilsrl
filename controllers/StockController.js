"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

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

self.getStockEntryByIdAndUpdate = async (req, res) => {
  try {
    const stock_entry_id = req.params.stock_entry_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const { data: updatedStockEntry, error } = await supabase
      .from("stock_entries")
      .update(update)
      .eq("id", stock_entry_id)
      .is("deleted_at", null);

    if (error) throw error;

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


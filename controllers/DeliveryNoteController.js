"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getDeliveryNotes = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("deliverynotes")
      .select("*, deliverynotes_products(*, products(*))")
      .is("deleted_at", null);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getDeliveryNoteById = async (req, res) => {
  const deliverynote_id = req.params.deliverynote_id;
  try {
    const { data, error } = await supabase
      .from("deliverynotes")
      .select("*")
      .eq("id", deliverynote_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getDeliveryNoteByDeliveryNoteName = async (req, res) => {
  const search = req.params.fantasy_name;
  try {
    const { data, error } = await supabase
      .from("deliverynotes")
      .select("*")
      .is("deleted_at", null)
      .ilike("fantasy_name", `%${search}%`);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getDeliveryNoteByEmail = async (req, res) => {
  const search = req.params.email;
  try {
    const { data, error } = await supabase
      .from("deliverynotes")
      .select("*")
      .is("deleted_at", null)
      .ilike("email", `%${search}%`);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createDeliveryNote = async (req, res) => {
  try {
    const deliverynote = {
      client_id: req.body.client_id,
      description: req.body.description,
      amount: req.body.amount,
    };

    const { data: newDeliveryNote, error } = await supabase
      .from("deliverynotes")
      .insert(deliverynote)
      .select();

    const deliverynoteProducts = req.body.products.map((product) => ({
      deliverynote_id: newDeliveryNote[0].id,
      product_id: product.product_id,
      quantity: product.quantity,
      price: product.price,
    }));

    const { data: newDeliveryNoteProducts, errorProducts } = await supabase
      .from("deliverynotes_products")
      .insert(deliverynoteProducts);

    const productsForStock = req.body.products.map((product) => ({
      id: product.product_id,
      quantity: product.quantity,
    }));

    const updatedStocks = await updateProductStock(productsForStock);

    if (error || errorProducts) {
      // Reverse the deliverynote creation
      const { data: deletedDeliveryNote, error: deleteError } = await supabase
        .from("deliverynotes")
        .delete()
        .eq("id", newDeliveryNote[0].id);

      const { data: deletedDeliveryNoteProducts, error: deleteErrorProducts } =
        await supabase
          .from("deliverynotes_products")
          .delete()
          .eq("deliverynote_id", newDeliveryNote[0].id);

      return res.json({ error: error.message || errorProducts.message });
    }

    return res.json(newDeliveryNote);
  } catch (e) {
    console.log("DeliveryNote creation error", e.message);
    return res.json(e);
  }
};

self.getDeliveryNoteByIdAndUpdate = async (req, res) => {
  try {
    const deliverynote_id = req.params.deliverynote_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const { data: updatedDeliveryNote, error } = await supabase
      .from("deliverynotes")
      .update(update)
      .eq("id", deliverynote_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedDeliveryNote);
  } catch (e) {
    console.error("delete deliverynote by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteDeliveryNoteById = async (req, res) => {
  try {
    const deliverynote_id = req.params.deliverynote_id;
    const update = { deleted_at: new Date() };
    const { data: updatedDeliveryNote, error } = await supabase
      .from("deliverynotes")
      .update(update)
      .eq("id", deliverynote_id);

    res.json(updatedDeliveryNote);
  } catch (e) {
    console.error("delete deliverynote by id", e.message);
    res.json({ error: e.message });
  }
};

const updateProductStock = async (products) => {
  try {
    // Creamos un array de promesas para actualizar los stocks de los productos
    const updateStockPromises = products.map(async (product) => {
      // Primero, obtenemos el stock actual del producto
      const { data: productData, error: getProductError } = await supabase
        .from("products")
        .select("stock")
        .eq("id", product.id)
        .is("deleted_at", null)
        .single(); // Esto trae solo un producto

      if (getProductError || !productData) {
        console.error(
          `Error al obtener stock del producto ${product.id}:`,
          getProductError
        );
        throw new Error(
          `Producto no encontrado o error al obtener stock para el producto ${product.id}`
        );
      }

      const currentStock = productData.stock;

      // Si el stock actual es menor que la cantidad solicitada, puedes lanzar un error o gestionar el caso
      if (currentStock < product.quantity) {
        throw new Error(
          `No hay suficiente stock para el producto ${product.id}`
        );
      }

      // Calculamos el nuevo stock después de la venta
      const newStock = currentStock - product.quantity;
      console.log(
        `AAA Actualizando stock del producto ${product.id}: Stock actual = ${currentStock}, Stock solicitado = ${product.stock}, Nuevo stock = ${newStock}`
      );

      // Actualizamos el stock en la base de datos
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
      return { id: product.id, newStock }; // Retornamos el producto con el nuevo stock
    });

    console.log("updateStockPromises", updateStockPromises);
    // Ejecutamos todas las promesas en paralelo
    const updatedProducts = await Promise.all(updateStockPromises);
    console.log("Productos actualizados correctamente:", updatedProducts);
    return updatedProducts;
  } catch (error) {
    console.error("Hubo un error al actualizar el stock:", error);
    throw new Error("Error al actualizar el stock de los productos");
  }
};

module.exports = self;

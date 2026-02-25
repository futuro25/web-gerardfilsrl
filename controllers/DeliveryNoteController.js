const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getDeliveryNotes = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("deliverynotes")
      .select(
        `
        *, 
        deliverynotes_products(*, products(*))
      `
      )
      .is("deleted_at", null);

    if (error) throw error;

    const dataWithOrderInfo = await Promise.all(
      data.map(async (deliveryNote) => {
        let orderStatus = null;
        let orderNumber = null;

        if (deliveryNote.order_id) {
          // Fetch order data
          const { data: orderData, error: orderError } = await supabase
            .from("orders")
            .select(
              `
              id,
              order_number,
              orders_products(
                product_id,
                quantity,
                quantity_delivered
              )
            `
            )
            .eq("id", deliveryNote.order_id)
            .single();

          if (!orderError && orderData) {
            orderNumber = orderData.order_number;

            // Calculate order status
            const allProducts = orderData.orders_products;
            const allDelivered = allProducts.every(
              (product) => (product.quantity_delivered || 0) >= product.quantity
            );
            orderStatus = allDelivered ? "ENTREGADO" : "PENDIENTE";
          }
        }

        return {
          ...deliveryNote,
          order_status: orderStatus,
          order_number: orderNumber,
        };
      })
    );

    res.json(dataWithOrderInfo);
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
      client_id: req.body.client_id || null,
      order_id: req.body.order_id || null,
      description: req.body.description || null,
      amount: req.body.amount || 0,
      number: req.body.number || null,
      order_number_text: req.body.order_number_text || null,
      remito_number: req.body.remito_number || null,
    };

    const { data: newDeliveryNote, error } = await supabase
      .from("deliverynotes")
      .insert(deliverynote)
      .select();

    if (error) {
      console.error("Error creating delivery note:", error);
      return res.json({ error: error.message });
    }

    const deliverynoteProducts = req.body.products.map((product) => ({
      deliverynote_id: newDeliveryNote[0].id,
      product_id: product.product_id || null,
      quantity: product.quantity || product.cantidad_por_talle || 0,
      price: product.price || 0,
      codigo: product.codigo || null,
      fuerza: product.fuerza || null,
      producto_tipo: product.producto_tipo || null,
      manga: product.manga || null,
      genero: product.genero || null,
      color: product.color || null,
      cuello: product.cuello || null,
      talle: product.talle || null,
      cantidad_por_talle: product.cantidad_por_talle || 0,
      cantidad_total: product.cantidad_total || 0,
      origen: product.origen || null,
      lo_que_falta: product.lo_que_falta || 0,
    }));

    const { data: newDeliveryNoteProducts, error: errorProducts } = await supabase
      .from("deliverynotes_products")
      .insert(deliverynoteProducts);

    if (errorProducts) {
      await supabase.from("deliverynotes").delete().eq("id", newDeliveryNote[0].id);
      console.error("Error creating delivery note products:", errorProducts);
      return res.json({ error: errorProducts.message });
    }

    // Only update stock for products with origen = "STOCK"
    const productsFromStock = req.body.products.filter(
      (product) => product.origen === "STOCK" && product.product_id
    );

    if (productsFromStock.length > 0) {
      const productsForStock = productsFromStock.map((product) => ({
        id: product.product_id,
        quantity: product.cantidad_por_talle || product.quantity || 0,
      }));

      try {
        await updateProductStock(productsForStock);
      } catch (stockError) {
        console.error("Error updating stock:", stockError);
      }
    }

    if (req.body.order_id) {
      await updateOrderProductsDelivered(req.body.order_id, req.body.products);
    }

    return res.json(newDeliveryNote);
  } catch (e) {
    console.log("DeliveryNote creation error", e.message);
    return res.json({ error: e.message });
  }
};

self.getDeliveryNoteByIdAndUpdate = async (req, res) => {
  try {
    const deliverynote_id = req.params.deliverynote_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const deliverynoteUpdate = {
      client_id: update.client_id,
      order_id: update.order_id || null,
      description: update.description,
      amount: update.amount,
      number: update.number,
    };

    const { data: updatedDeliveryNote, error } = await supabase
      .from("deliverynotes")
      .update(deliverynoteUpdate)
      .eq("id", deliverynote_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedDeliveryNote);
  } catch (e) {
    console.error("update deliverynote by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteDeliveryNoteById = async (req, res) => {
  try {
    const deliverynote_id = req.params.deliverynote_id;

    // Get delivery note products before deleting
    const { data: deliveryNote, error: getError } = await supabase
      .from("deliverynotes")
      .select(
        `
        *,
        deliverynotes_products(*)
      `
      )
      .eq("id", deliverynote_id)
      .is("deleted_at", null)
      .single();

    if (getError || !deliveryNote) {
      return res.json({ error: "Remito no encontrado" });
    }

    // Restore stock for each product
    const restoreStockPromises = deliveryNote.deliverynotes_products.map(
      async (dnp) => {
        const { data: productData, error: getProductError } = await supabase
          .from("products")
          .select("stock")
          .eq("id", dnp.product_id)
          .is("deleted_at", null)
          .single();

        if (getProductError || !productData) {
          console.error(
            `Error al obtener producto ${dnp.product_id}:`,
            getProductError
          );
          return;
        }

        const newStock = productData.stock + dnp.quantity;
        console.log(
          `[v0] Restaurando stock del producto ${dnp.product_id}: ${productData.stock} + ${dnp.quantity} = ${newStock}`
        );

        const { error: updateError } = await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", dnp.product_id);

        if (updateError) {
          console.error(
            `Error al restaurar stock del producto ${dnp.product_id}:`,
            updateError
          );
        }
      }
    );

    await Promise.all(restoreStockPromises);

    // If linked to an order, reduce the delivered quantities
    if (deliveryNote.order_id) {
      const revertPromises = deliveryNote.deliverynotes_products.map(
        async (dnp) => {
          const deliveredQty = dnp.cantidad_por_talle || dnp.quantity || 0;
          if (deliveredQty <= 0) return;

          let query = supabase
            .from("orders_products")
            .select("id, quantity_delivered")
            .eq("order_id", deliveryNote.order_id);

          if (dnp.product_id) {
            query = query.eq("product_id", dnp.product_id);
          } else {
            if (dnp.producto_tipo) query = query.eq("producto_tipo", dnp.producto_tipo);
            if (dnp.talle) query = query.eq("talle", dnp.talle);
            if (dnp.color) query = query.eq("color", dnp.color);
            if (dnp.manga) query = query.eq("manga", dnp.manga);
            if (dnp.genero) query = query.eq("genero", dnp.genero);
            if (dnp.cuello) query = query.eq("cuello", dnp.cuello);
            if (dnp.fuerza) query = query.eq("fuerza", dnp.fuerza);
          }

          const { data: orderProducts, error: getError } = await query;

          if (getError) {
            console.error(`Error obteniendo order product: ${getError.message}`);
            return;
          }

          if (!orderProducts || orderProducts.length === 0) {
            console.log(`No matching order product found for variant to revert`);
            return;
          }

          const orderProduct = orderProducts[0];
          const currentDelivered = orderProduct?.quantity_delivered || 0;
          const newDelivered = Math.max(0, currentDelivered - deliveredQty);

          console.log(
            `Revirtiendo cantidad entregada: ${currentDelivered} - ${deliveredQty} = ${newDelivered}`
          );

          const { error: updateError } = await supabase
            .from("orders_products")
            .update({ quantity_delivered: newDelivered })
            .eq("id", orderProduct.id);

          if (updateError) {
            console.error(`Error revirtiendo cantidad entregada: ${updateError.message}`);
          }
        }
      );

      await Promise.all(revertPromises);
    }

    // Soft delete the delivery note
    const update = { deleted_at: new Date() };
    const { data: updatedDeliveryNote, error } = await supabase
      .from("deliverynotes")
      .update(update)
      .eq("id", deliverynote_id);

    if (error) throw error;

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

const updateOrderProductsDelivered = async (orderId, products) => {
  try {
    for (const product of products) {
      const deliveredQty = product.cantidad_por_talle || product.quantity || 0;
      if (deliveredQty <= 0) continue;

      let query = supabase
        .from("orders_products")
        .select("id, quantity_delivered")
        .eq("order_id", orderId);

      if (product.product_id) {
        query = query.eq("product_id", product.product_id);
      } else {
        if (product.producto_tipo) query = query.eq("producto_tipo", product.producto_tipo);
        if (product.talle) query = query.eq("talle", product.talle);
        if (product.color) query = query.eq("color", product.color);
        if (product.manga) query = query.eq("manga", product.manga);
        if (product.genero) query = query.eq("genero", product.genero);
        if (product.cuello) query = query.eq("cuello", product.cuello);
        if (product.fuerza) query = query.eq("fuerza", product.fuerza);
      }

      const { data: orderProducts, error: getError } = await query;

      if (getError) {
        console.error(`Error getting order product: ${getError.message}`);
        continue;
      }

      if (!orderProducts || orderProducts.length === 0) {
        console.log(`No matching order product found for variant`);
        continue;
      }

      const orderProduct = orderProducts[0];
      const currentDelivered = orderProduct?.quantity_delivered || 0;
      const newDelivered = currentDelivered + deliveredQty;

      const { error: updateError } = await supabase
        .from("orders_products")
        .update({ quantity_delivered: newDelivered })
        .eq("id", orderProduct.id);

      if (updateError) {
        console.error(`Error updating delivered quantity: ${updateError.message}`);
      } else {
        console.log(`Updated order product ${orderProduct.id}: delivered ${currentDelivered} -> ${newDelivered}`);
      }
    }
  } catch (error) {
    console.error("Error updating order products delivered:", error);
    throw error;
  }
};

module.exports = self;

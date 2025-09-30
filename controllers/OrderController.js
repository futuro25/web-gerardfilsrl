const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getOrders = async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*, orders_products(*, products(*)), clients(fantasy_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const ordersWithDelivered = await Promise.all(
      orders.map(async (order) => {
        if (order.orders_products) {
          const productsWithDelivered = await Promise.all(
            order.orders_products.map(async (op) => {
              const { data: deliveredData, error: deliveredError } =
                await supabase
                  .from("deliverynotes")
                  .select(
                    "id, deliverynotes_products!inner(product_id, quantity)"
                  )
                  .eq("client_id", order.client_id)
                  .eq("deliverynotes_products.product_id", op.product_id)
                  .is("deleted_at", null);

              console.log(
                "[v0] Query for client:",
                order.client_id,
                "product:",
                op.product_id
              );
              console.log("[v0] deliveredData:", deliveredData);
              console.log("[v0] deliveredError:", deliveredError);

              let totalDelivered = 0;
              if (deliveredData && deliveredData.length > 0) {
                deliveredData.forEach((dn) => {
                  if (dn.deliverynotes_products) {
                    dn.deliverynotes_products.forEach((dnp) => {
                      totalDelivered += dnp.quantity || 0;
                    });
                  }
                });
              }

              console.log("[v0] totalDelivered:", totalDelivered);

              return {
                ...op,
                quantity_delivered: totalDelivered,
                quantity_pending: op.quantity - totalDelivered,
              };
            })
          );
          order.orders_products = productsWithDelivered;
        }
        return order;
      })
    );

    res.json(ordersWithDelivered);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getActiveOrders = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        orders_products(*, products(*)),
        clients(fantasy_name)
      `
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const activeOrders = data
      .map((order) => {
        const hasPendingProducts = order.orders_products?.some((op) => {
          const quantityDelivered = op.quantity_delivered || 0;
          return op.quantity > quantityDelivered;
        });

        if (hasPendingProducts) {
          return {
            ...order,
            client_name: order.clients?.fantasy_name || "",
          };
        }
        return null;
      })
      .filter((order) => order !== null);

    res.json(activeOrders);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getOrderById = async (req, res) => {
  const order_id = req.params.order_id;
  try {
    const { data: orderData, error } = await supabase
      .from("orders")
      .select("*, orders_products(*, products(*))")
      .eq("id", order_id)
      .is("deleted_at", null);

    if (error) throw error;

    const order = _.first(orderData);

    if (!order) {
      return res.json({ error: "Order not found" });
    }

    if (order.orders_products) {
      const productsWithDelivered = await Promise.all(
        order.orders_products.map(async (op) => {
          const { data: deliveredData, error: deliveredError } = await supabase
            .from("deliverynotes")
            .select("id, deliverynotes_products!inner(product_id, quantity)")
            .eq("client_id", order.client_id)
            .eq("deliverynotes_products.product_id", op.product_id)
            .is("deleted_at", null);

          console.log(
            "[v0] Query for client:",
            order.client_id,
            "product:",
            op.product_id
          );
          console.log("[v0] deliveredData:", deliveredData);
          console.log("[v0] deliveredError:", deliveredError);

          let totalDelivered = 0;
          if (deliveredData && deliveredData.length > 0) {
            deliveredData.forEach((dn) => {
              if (dn.deliverynotes_products) {
                dn.deliverynotes_products.forEach((dnp) => {
                  totalDelivered += dnp.quantity || 0;
                });
              }
            });
          }

          console.log("[v0] totalDelivered:", totalDelivered);

          return {
            ...op,
            quantity_delivered: totalDelivered,
            quantity_pending: op.quantity - totalDelivered,
          };
        })
      );
      order.orders_products = productsWithDelivered;
    }

    res.json(order);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createOrder = async (req, res) => {
  try {
    const order = {
      client_id: req.body.client_id,
      order_number: req.body.order_number,
      order_type: req.body.order_type,
      description: req.body.description,
      amount: req.body.amount,
    };

    const { data: newOrder, error } = await supabase
      .from("orders")
      .insert(order)
      .select();

    if (error) {
      console.error("Error creating order:", error);
      return res.json({ error: error.message });
    }

    const orderProducts = req.body.products.map((product) => ({
      order_id: newOrder[0].id,
      product_id: product.product_id,
      quantity: product.quantity,
      quantity_delivered: 0,
      price: product.price,
    }));

    const { data: newOrderProducts, error: errorProducts } = await supabase
      .from("orders_products")
      .insert(orderProducts);

    if (errorProducts) {
      await supabase.from("orders").delete().eq("id", newOrder[0].id);
      console.error("Error creating order products:", errorProducts);
      return res.json({ error: errorProducts.message });
    }

    return res.json(newOrder);
  } catch (e) {
    console.log("Order creation error", e.message);
    return res.json({ error: e.message });
  }
};

self.getOrderByIdAndUpdate = async (req, res) => {
  try {
    const order_id = req.params.order_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    if (update.products) {
      const { error: deleteError } = await supabase
        .from("orders_products")
        .delete()
        .eq("order_id", order_id);

      if (deleteError) {
        console.error("Error deleting order products:", deleteError);
        return res.json({ error: deleteError.message });
      }

      const orderProducts = update.products.map((product) => ({
        order_id: order_id,
        product_id: product.product_id,
        quantity: product.quantity,
        quantity_delivered: 0,
        price: product.price,
      }));

      const { error: insertError } = await supabase
        .from("orders_products")
        .insert(orderProducts);

      if (insertError) {
        console.error("Error inserting order products:", insertError);
        return res.json({ error: insertError.message });
      }

      delete update.products;
    }

    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order_id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;

    res.json(updatedOrder);
  } catch (e) {
    console.error("update order by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteOrderById = async (req, res) => {
  try {
    const order_id = req.params.order_id;
    const update = { deleted_at: new Date() };

    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order_id)
      .select();

    if (error) throw error;

    res.json(updatedOrder);
  } catch (e) {
    console.error("delete order by id", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;

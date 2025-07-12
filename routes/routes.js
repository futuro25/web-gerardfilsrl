"use strict";

const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController.js");
const SupplierController = require("../controllers/SupplierController.js");
const ClientController = require("../controllers/ClientController.js");
const InvoicesController = require("../controllers/InvoicesController.js");
const DeliveriesController = require("../controllers/DeliveriesController.js");
const UtilsController = require("../controllers/UtilsController.js");
const PaymentsController = require("../controllers/PaymentsController.js");
const CashflowController = require("../controllers/CashflowController");
const ProductController = require("../controllers/ProductController.js");
const DeliveryNoteController = require("../controllers/DeliveryNoteController.js");
const PaycheckController = require("../controllers/PaycheckController.js");

// USERS
router.get("/users", (req, res, next) =>
  UserController.getUsers(req, res, next)
);

router.post("/users/login", (req, res, next) =>
  UserController.login(req, res, next)
);

router.get("/users/:user_id", (req, res, next) =>
  UserController.getUserById(req, res, next)
);

router.get("/users/medical-history/:user_id", (req, res, next) =>
  UserController.medicalHistory(req, res, next)
);

router.get("/users/username/:username", (req, res, next) =>
  UserController.getUserByUsername(req, res, next)
);

router.get("/users/email/:email", (req, res, next) =>
  UserController.getUserByEmail(req, res, next)
);

router.post("/users", (req, res, next) =>
  UserController.createUser(req, res, next)
);

router.post("/users/register", (req, res, next) =>
  UserController.createUser(req, res, next)
);

router.post("/users/forgot-password", (req, res, next) =>
  UserController.recoverPassword(req, res, next)
);

router.patch("/users/:user_id", (req, res, next) =>
  UserController.getUserByIdAndUpdate(req, res, next)
);

router.delete("/users/:user_id", (req, res, next) =>
  UserController.deleteUserById(req, res, next)
);

// PAYMENTS
router.get("/payments", (req, res, next) =>
  PaymentsController.getPayments(req, res, next)
);

router.post("/payments", (req, res, next) =>
  PaymentsController.createPayment(req, res, next)
);

router.patch("/payments/:payment_id", (req, res, next) =>
  PaymentsController.getPaymentByIdAndUpdate(req, res, next)
);

router.delete("/payments/:payment_id", (req, res, next) =>
  PaymentsController.deletePaymentById(req, res, next)
);

// SUPPLIERS

router.get("/suppliers", (req, res, next) =>
  SupplierController.getSuppliers(req, res, next)
);

router.get("/suppliers/:supplier_id", (req, res, next) =>
  SupplierController.getSupplierById(req, res, next)
);

router.get("/suppliers/name/:fantasy_name", (req, res, next) =>
  SupplierController.getSupplierBySupplierName(req, res, next)
);

router.get("/suppliers/email/:email", (req, res, next) =>
  SupplierController.getSupplierByEmail(req, res, next)
);

router.post("/suppliers", (req, res, next) =>
  SupplierController.createSupplier(req, res, next)
);

router.patch("/suppliers/:supplier_id", (req, res, next) =>
  SupplierController.getSupplierByIdAndUpdate(req, res, next)
);

router.delete("/suppliers/:supplier_id", (req, res, next) =>
  SupplierController.deleteSupplierById(req, res, next)
);

// DELIVERY_NOTE

router.get("/deliverynotes", (req, res, next) =>
  DeliveryNoteController.getDeliveryNotes(req, res, next)
);

router.get("/deliverynotes/:deliverynote_id", (req, res, next) =>
  DeliveryNoteController.getDeliveryNoteById(req, res, next)
);

router.get("/deliverynotes/name/:fantasy_name", (req, res, next) =>
  DeliveryNoteController.getDeliveryNoteByDeliveryNoteName(req, res, next)
);

router.get("/deliverynotes/email/:email", (req, res, next) =>
  DeliveryNoteController.getDeliveryNoteByEmail(req, res, next)
);

router.post("/deliverynotes", (req, res, next) =>
  DeliveryNoteController.createDeliveryNote(req, res, next)
);

router.patch("/deliverynotes/:deliverynote_id", (req, res, next) =>
  DeliveryNoteController.getDeliveryNoteByIdAndUpdate(req, res, next)
);

router.delete("/deliverynotes/:deliverynote_id", (req, res, next) =>
  DeliveryNoteController.deleteDeliveryNoteById(req, res, next)
);

// PRODUCTS

router.get("/products", (req, res, next) =>
  ProductController.getProducts(req, res, next)
);

router.get("/products/:product_id", (req, res, next) =>
  ProductController.getProductById(req, res, next)
);

router.get("/products/name/:name", (req, res, next) =>
  ProductController.getProductByProductName(req, res, next)
);

router.post("/products", (req, res, next) =>
  ProductController.createProduct(req, res, next)
);

router.patch("/products/:product_id", (req, res, next) =>
  ProductController.getProductByIdAndUpdate(req, res, next)
);

router.delete("/products/:product_id", (req, res, next) =>
  ProductController.deleteProductById(req, res, next)
);

// CLIENTS

router.get("/clients", (req, res, next) =>
  ClientController.getClients(req, res, next)
);

router.get("/clients/:client_id", (req, res, next) =>
  ClientController.getClientById(req, res, next)
);

router.get("/clients/name/:fantasy_name", (req, res, next) =>
  ClientController.getClientByClientName(req, res, next)
);

router.get("/clients/email/:email", (req, res, next) =>
  ClientController.getClientByEmail(req, res, next)
);

router.post("/clients", (req, res, next) =>
  ClientController.createClient(req, res, next)
);

router.patch("/clients/:client_id", (req, res, next) =>
  ClientController.getClientByIdAndUpdate(req, res, next)
);

router.delete("/clients/:client_id", (req, res, next) =>
  ClientController.deleteClientById(req, res, next)
);

// INVOICES

router.get("/invoices", (req, res, next) =>
  InvoicesController.getInvoices(req, res, next)
);

router.get("/invoices/:invoice_id", (req, res, next) =>
  InvoicesController.getInvoiceById(req, res, next)
);

router.post("/invoices", (req, res, next) =>
  InvoicesController.createInvoice(req, res, next)
);

router.patch("/invoices/:invoice_id", (req, res, next) =>
  InvoicesController.getInvoiceByIdAndUpdate(req, res, next)
);

router.delete("/invoices/:invoice_id", (req, res, next) =>
  InvoicesController.deleteInvoiceById(req, res, next)
);

// DELIVERIES

router.get("/deliveries", (req, res, next) =>
  DeliveriesController.getDeliveries(req, res, next)
);

router.get("/deliveries/:delivery_id", (req, res, next) =>
  DeliveriesController.getDeliveryById(req, res, next)
);

router.post("/deliveries", (req, res, next) =>
  DeliveriesController.createDelivery(req, res, next)
);

router.patch("/deliveries/:delivery_id", (req, res, next) =>
  DeliveriesController.getDeliveryByIdAndUpdate(req, res, next)
);

router.delete("/deliveries/:delivery_id", (req, res, next) =>
  DeliveriesController.deleteDeliveryById(req, res, next)
);

// PAYCHECKS

router.get("/paychecks", (req, res, next) =>
  PaycheckController.getPaychecks(req, res, next)
);

router.get("/paychecks/:paycheck_id", (req, res, next) =>
  PaycheckController.getPaycheckById(req, res, next)
);

router.post("/paychecks", (req, res, next) =>
  PaycheckController.createPaycheck(req, res, next)
);

router.patch("/paychecks/:paycheck_id", (req, res, next) =>
  PaycheckController.getPaycheckByIdAndUpdate(req, res, next)
);

router.delete("/paychecks/:paycheck_id", (req, res, next) =>
  PaycheckController.deletePaycheckById(req, res, next)
);

// CASHFLOW

router.get("/cashflow", (req, res, next) =>
  CashflowController.getCashflows(req, res, next)
);

router.get("/cashflow/:cashflow_id", (req, res, next) =>
  CashflowController.getCashflowById(req, res, next)
);

router.post("/cashflow", (req, res, next) =>
  CashflowController.createCashflow(req, res, next)
);

router.patch("/cashflow/:cashflow_id", (req, res, next) =>
  CashflowController.updateCashflowById(req, res, next)
);

router.delete("/cashflow/:cashflow_id", (req, res, next) =>
  CashflowController.deleteCashflowById(req, res, next)
);

// UTILS
router.post("/utils/send-whatsapp", (req, res, next) =>
  UtilsController.sendWhatsApp(req, res, next)
);

router.post("/utils/email", (req, res, next) =>
  UtilsController.createConfirmAccountTemplate(req, res, next)
);

module.exports = router;

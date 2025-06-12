"use strict";

const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController.js");
const SupplierController = require("../controllers/SupplierController.js");
const InvoicesController = require("../controllers/InvoicesController.js");
const UtilsController = require("../controllers/UtilsController.js");
const PaymentsController = require("../controllers/PaymentsController.js");

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

// INVOICES

router.get("/invoices", (req, res, next) =>
  InvoicesController.getInvoices(req, res, next)
);

router.get("/invoices/:supplier_id", (req, res, next) =>
  InvoicesController.getInvoiceById(req, res, next)
);

router.post("/invoices", (req, res, next) =>
  InvoicesController.createInvoice(req, res, next)
);

router.patch("/invoices/:supplier_id", (req, res, next) =>
  InvoicesController.getInvoiceByIdAndUpdate(req, res, next)
);

router.delete("/invoices/:supplier_id", (req, res, next) =>
  InvoicesController.deleteInvoiceById(req, res, next)
);

// UTILS
router.post("/utils/send-whatsapp", (req, res, next) =>
  UtilsController.sendWhatsApp(req, res, next)
);

router.post("/utils/email", (req, res, next) =>
  UtilsController.createConfirmAccountTemplate(req, res, next)
);

module.exports = router;

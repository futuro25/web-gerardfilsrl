-- Script para crear las tablas de pagos con certificados de retención
-- Ejecutar este script en Supabase SQL Editor

-- Tabla principal de pagos con retenciones
CREATE TABLE IF NOT EXISTS retention_payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_number VARCHAR(100) NOT NULL,
  category_code VARCHAR(10) NOT NULL,
  category_detail TEXT,
  supplier VARCHAR(255) NOT NULL,
  supplier_cuit VARCHAR(20) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  total_amount DECIMAL(15, 2) NOT NULL,
  net_amount DECIMAL(15, 2) NOT NULL,
  iva DECIMAL(15, 2) NOT NULL,
  profits_condition VARCHAR(50) NOT NULL CHECK (profits_condition IN ('Inscripto', 'No inscripto')),
  retention_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_to_pay DECIMAL(15, 2) NOT NULL,
  cashflow_id BIGINT REFERENCES cashflow(id),
  invoice_id BIGINT REFERENCES invoices(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de certificados de retención
CREATE TABLE IF NOT EXISTS retention_certificates (
  id BIGSERIAL PRIMARY KEY,
  retention_payment_id BIGINT NOT NULL REFERENCES retention_payments(id) ON DELETE CASCADE,
  certificate_number VARCHAR(100) UNIQUE,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  retention_amount DECIMAL(15, 2) NOT NULL,
  category_code VARCHAR(10) NOT NULL,
  category_detail TEXT,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_cuit VARCHAR(20) NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  net_amount DECIMAL(15, 2) NOT NULL,
  profits_condition VARCHAR(50) NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_retention_payments_supplier_cuit ON retention_payments(supplier_cuit);
CREATE INDEX IF NOT EXISTS idx_retention_payments_invoice_number ON retention_payments(invoice_number);
CREATE INDEX IF NOT EXISTS idx_retention_payments_issue_date ON retention_payments(issue_date);
CREATE INDEX IF NOT EXISTS idx_retention_payments_deleted_at ON retention_payments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_retention_payments_cashflow_id ON retention_payments(cashflow_id);
CREATE INDEX IF NOT EXISTS idx_retention_payments_invoice_id ON retention_payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_retention_certificates_payment_id ON retention_certificates(retention_payment_id);
CREATE INDEX IF NOT EXISTS idx_retention_certificates_certificate_number ON retention_certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_retention_certificates_issued_date ON retention_certificates(issued_date);
CREATE INDEX IF NOT EXISTS idx_retention_certificates_deleted_at ON retention_certificates(deleted_at);

-- Comentarios para documentación
COMMENT ON TABLE retention_payments IS 'Registro de pagos con cálculo de retenciones según Régimen 830';
COMMENT ON TABLE retention_certificates IS 'Certificados de retención emitidos para cada pago';
COMMENT ON COLUMN retention_payments.category_code IS 'Código de categoría del Régimen 830 (ej: 94, 116)';
COMMENT ON COLUMN retention_payments.category_detail IS 'Detalle de la categoría del Régimen 830';
COMMENT ON COLUMN retention_payments.profits_condition IS 'Condición frente a Ganancias: Inscripto o No inscripto';
COMMENT ON COLUMN retention_payments.retention_amount IS 'Monto calculado de retención';
COMMENT ON COLUMN retention_payments.total_to_pay IS 'Total a pagar al proveedor (total_amount - retention_amount)';
COMMENT ON COLUMN retention_certificates.certificate_number IS 'Número único del certificado de retención';


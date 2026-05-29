"use strict";

const nodemailer = require("nodemailer");

/**
 * Envío de correos vía SMTP (nodemailer).
 * Variables de entorno:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
 */

function getSmtpConfig() {
  return {
    smtp_host: process.env.SMTP_HOST || "smtp.gmail.com",
    smtp_port: process.env.SMTP_PORT || "587",
    smtp_user: process.env.SMTP_USER || "",
    smtp_pass: process.env.SMTP_PASS || "",
    mail_from: process.env.MAIL_FROM || process.env.SMTP_USER || "",
  };
}

function createTransporter() {
  const config = getSmtpConfig();
  const port = parseInt(config.smtp_port, 10);

  if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
    throw new Error(
      "Configuración SMTP incompleta. Defina SMTP_HOST, SMTP_USER y SMTP_PASS."
    );
  }

  return nodemailer.createTransport({
    host: config.smtp_host,
    port,
    secure: port === 465,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });
}

/**
 * @param {{ to: string, subject: string, text?: string, html?: string, replyTo?: string }} options
 * @returns {Promise<{ success: boolean, messageId?: string, accepted?: string[], rejected?: string[], error?: string }>}
 */
async function sendEmail(options) {
  const { to, subject, text, html, replyTo } = options;

  if (!to || !subject) {
    return {
      success: false,
      error: "Los campos 'to' y 'subject' son requeridos",
    };
  }

  if (!text && !html) {
    return {
      success: false,
      error: "Debe proporcionar 'text' o 'html' para el cuerpo del email",
    };
  }

  try {
    const config = getSmtpConfig();
    const from = config.mail_from;

    if (!from) {
      return {
        success: false,
        error: "MAIL_FROM no está configurado",
      };
    }

    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      replyTo,
    });

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error) {
    console.error("[Mailer] Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error al enviar email",
    };
  }
}

module.exports = {
  sendEmail,
  createTransporter,
  getSmtpConfig,
};

"use strict";

const self = {};
const _ = require("lodash");
const sgMail = require("@sendgrid/mail");
const path = require("path");
const fs = require("fs");
const config = require("../config");

self.sendWhatsApp = async ({
  template,
  cellphone,
  prefix,
  contentVariables,
}) => {
  const ContentVariables = contentVariables;
  const prefixNumber = prefix || "+549";
  const clientNumber = prefixNumber + cellphone;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  const whatsAppTemplate = process.env.TWILIO_TEMPLATES_CONFIRMED_APPOINTMENT;

  if (!whatsAppTemplate) {
    return { error: "Template not found" };
  }
  if (!ContentVariables) {
    return { error: "Content variables not found" };
  }
  if (!clientNumber) {
    return { error: "Client number not found" };
  }

  const client = require("twilio")(accountSid, authToken);

  const twilioObject = {
    from: `whatsapp:${twilioWhatsAppNumber}`,
    contentSid: whatsAppTemplate,
    contentVariables: JSON.stringify(ContentVariables),
    to: `whatsapp:${clientNumber}`,
  };

  try {
    client.messages.create(twilioObject).then((message) => {
      console.log(message.sid);
      return { msg: "ok" };
    });
  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
};

self.createConfirmedAppointmentTemplate = async (
  emailTo,
  userName,
  professionalName,
  professionalAddress,
  appointmentInfo
) => {
  try {
    const subject = "Confirmación de turno en " + config.brand;
    const filePath = path.join(
      __dirname,
      `../emails/${config.brand}/confirmed_appointment.html`
    );
    let html = fs.readFileSync(filePath, "utf8");

    html = html.replace("{{USER_NAME_LASTNAME}}", userName);
    html = html.replace(
      "{{PROFESSIONAL_NAME_LASTNAME_CATEGORY}}",
      professionalName
    );
    html = html.replace("{{PROFESSIONAL_ADDRESS}}", professionalAddress);
    html = html.replace("{{APPOINTMENT_INFO}}", appointmentInfo);

    await self.sendEmail(emailTo, subject, html);

    return { msg: "Email sent" };
  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
};

self.createConfirmAccountTemplate = async (name, emailTo) => {
  try {
    const subject = "Bienvenido a " + " " + config.brand;
    const filePath = path.join(
      __dirname,
      `../emails/${config.brand}/welcome.html`
    );
    let html = fs.readFileSync(filePath, "utf8");

    html = html.replace("{{USER_NAME}}", name);
    html = html.replace("{{BRAND}}", config.brand);
    html = html.replace(
      "{{LINK_CONFIRM_ACCOUNT}}",
      config.link_confirm_account
    );

    await self.sendEmail(emailTo, subject, html);

    return { msg: "Email sent" };
  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
};

self.sendEmail = async (emailTo, subject, html) => {
  sgMail.setApiKey(process.env.SENGRID_API_KEY);
  const msg = {
    to: emailTo,
    from: process.env.SENGRID_EMAIL,
    subject: subject,
    text: subject,
    html: html,
  };

  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent.");
      return true;
    })
    .catch((error) => {
      console.error(JSON.stringify(error));
      return false;
    });
};

module.exports = self;

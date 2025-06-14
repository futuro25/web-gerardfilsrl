const sgMail = require("@sendgrid/mail");
const EMAIL_USER = "gerardfil.dev@gmail.com";
const SUBJECT = "Invitacion a la plataforma de gerardfil";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail(to, html) {
  console.log("SENDGRID_API_KEY exists?", !!process.env.SENDGRID_API_KEY);
  console.log("SENDGRID_API_KEY:", process.env.SENDGRID_API_KEY?.slice?.(0, 5));

  const msg = {
    to: to,
    from: EMAIL_USER,
    subject: SUBJECT,
    text: SUBJECT,
    html: html,
  };

  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent.");
    })
    .catch((error) => {
      console.error(error);
    });
}

module.exports = sendEmail;

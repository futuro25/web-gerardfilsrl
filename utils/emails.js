const sgMail = require("@sendgrid/mail");
const EMAIL_USER = "gerardfil.dev@gmail.com";
const SUBJECT = "Invitacion a la plataforma de gerardfil";

async function sendEmail(to, html) {
  console.log("API_KEY", process.env.SENDGRID_API_KEY);

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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

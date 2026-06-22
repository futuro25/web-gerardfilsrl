"use strict";

const self = {};
const {
  sendPendingMovementsReport,
} = require("../services/pendingMovementsReportService");

function checkCronSecret(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const provided =
    req.headers["x-cron-secret"] ||
    req.query.secret ||
    req.body?.secret;
  return provided === secret;
}

self.sendPendingMovementsReport = async (req, res) => {
  try {
    if (!checkCronSecret(req, res)) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const recipients =
      process.env.CRON_PENDING_MOVEMENTS_RECIPIENTS ||
      req.body?.to;

    if (!recipients?.trim()) {
      return res.status(400).json({
        error: "Configure CRON_PENDING_MOVEMENTS_RECIPIENTS o envíe 'to' en el body",
      });
    }

    const to = recipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .join(", ");

    const result = await sendPendingMovementsReport({ to });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.json({
      success: true,
      messageId: result.messageId,
      summary: result.summary,
      chequesSummary: result.chequesSummary,
      vepsSummary: result.vepsSummary,
    });
  } catch (e) {
    console.error("sendPendingMovementsReport cron:", e);
    return res.status(500).json({ error: e.message });
  }
};

module.exports = self;

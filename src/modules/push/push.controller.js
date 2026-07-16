// ============================================================
// LAUNCHPAD — Push Subscriptions Controller
// ============================================================

import * as service from "./push.service.js";

export async function subscribe(req, res) {
  const { endpoint, p256dhKey, authKey, deviceInfo } = req.body;
  const userId = req.user.id;
  const subscription = await service.subscribe(userId, { endpoint, p256dhKey, authKey, deviceInfo });
  res.json(subscription);
}

export async function unsubscribe(req, res) {
  const { endpoint } = req.body;
  const userId = req.user.id;
  await service.unsubscribe(userId, endpoint);
  res.json({ success: true });
}

export async function getMySubscriptions(req, res) {
  const userId = req.user.id;
  const subscriptions = await service.getUserSubscriptions(userId);
  res.json(subscriptions);
}

import webpush from 'web-push';
import databaseClient from '../db/index.js';

// VAPID keys must come from the environment — no committed fallback. Generate a
// pair with `npx web-push generate-vapid-keys` and set VAPID_PUBLIC_KEY /
// VAPID_PRIVATE_KEY. Push simply no-ops if they're absent.
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:notifications@example.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
} else {
  console.warn('[push] VAPID keys not set — web push disabled.');
}

export { VAPID_PUBLIC };

export async function saveSubscription(userId, workspaceId, subscription, alertTypes = ['any']) {
  await databaseClient.database
    .from('push_subscriptions')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      subscription: JSON.stringify(subscription),
      alert_types: JSON.stringify(alertTypes),
    });
}

export async function removeSubscription(userId, endpoint) {
  const { data: subs } = await databaseClient.database
    .from('push_subscriptions')
    .select()
    .eq('user_id', userId);

  for (const sub of subs || []) {
    const parsed = JSON.parse(sub.subscription);
    if (parsed.endpoint === endpoint) {
      await databaseClient.database.from('push_subscriptions').delete().eq('id', sub.id);
    }
  }
}

export async function sendPushToWorkspace(workspaceId, payload, alertType = 'any') {
  if (!VAPID_PRIVATE) return; // push disabled without VAPID keys
  const { data: subs } = await databaseClient.database
    .from('push_subscriptions')
    .select()
    .eq('workspace_id', workspaceId);

  if (!subs?.length) return;

  const message = JSON.stringify(payload);
  const errors = [];

  for (const sub of subs) {
    const types = JSON.parse(sub.alert_types || '["any"]');
    if (types.includes('any') || types.includes(alertType)) {
      try {
        await webpush.sendNotification(JSON.parse(sub.subscription), message);
      } catch (err) {
        errors.push(err.message);
        if (err.statusCode === 410) {
          // Subscription expired — clean it up.
          await databaseClient.database.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  }

  if (errors.length) console.warn('[push] Delivery errors:', errors);
}

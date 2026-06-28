import webpush from 'web-push';
import insforge from '../db/index.js';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ||
  'BE1R-i9MOA_mFHyBIjmix-txNgBBoPt_4zBKutZjQiETyQG3oj3b0r3XtpDKR7cJUXish41q6Gkb7aa5MVsYW2I';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ||
  'G6Y2RUSvRB7u_CnJ0_K8LLFAMkzEJ-mSZkH0MfWIhmE';

webpush.setVapidDetails(
  'mailto:notifications@pricing-intel.app',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

export { VAPID_PUBLIC };

export async function saveSubscription(userId, workspaceId, subscription, alertTypes = ['any']) {
  await insforge.database
    .from('push_subscriptions')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      subscription: JSON.stringify(subscription),
      alert_types: JSON.stringify(alertTypes),
    });
}

export async function removeSubscription(userId, endpoint) {
  const { data: subs } = await insforge.database
    .from('push_subscriptions')
    .select()
    .eq('user_id', userId);

  for (const sub of subs || []) {
    const parsed = JSON.parse(sub.subscription);
    if (parsed.endpoint === endpoint) {
      await insforge.database.from('push_subscriptions').delete().eq('id', sub.id);
    }
  }
}

export async function sendPushToWorkspace(workspaceId, payload, alertType = 'any') {
  const { data: subs } = await insforge.database
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
          await insforge.database.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  }

  if (errors.length) console.warn('[push] Delivery errors:', errors);
}

export const EXPECTED_BUSINESS_PHONE = '77004446911';
const required = ['WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_WABA_ID', 'WHATSAPP_PHONE_NUMBER_ID'];

// Never return credentials or raw provider errors to the browser or logs.
export async function inspectWhatsAppConnection(env, fetcher = fetch, checkMeta = false) {
  const missing = required.filter(key => !env[key]?.trim());
  const result = {
    enabled: env.WHATSAPP_INBOX_ENABLED === 'true', missing,
    expectedPhone: '+7 700 444 69 11',
    testSender: env.WHATSAPP_PHONE_NUMBER_ID === '1298404383366536',
    meta: { state: 'unchecked' },
  };
  if (!checkMeta) return result;
  const metaMissing = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_ID', 'WHATSAPP_GRAPH_API_VERSION', 'WHATSAPP_WABA_ID', 'WHATSAPP_PHONE_NUMBER_ID'].filter(key => !env[key]?.trim());
  if (metaMissing.length) { result.meta = { state: 'missing', missing: metaMissing }; return result; }
  if (!/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_API_VERSION) || !/^\d+$/.test(env.WHATSAPP_WABA_ID) || !/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID) || !/^\d+$/.test(env.WHATSAPP_APP_ID)) {
    result.meta = { state: 'invalid' }; return result;
  }
  try {
    const get = async (path, stage) => {
      const response = await fetcher(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${path}`, {
        headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const error = new Error('META_UNAVAILABLE');
        error.diagnostics = { stage, httpStatus: response.status, code: Number.isInteger(body.error?.code) ? body.error.code : null, subcode: Number.isInteger(body.error?.error_subcode) ? body.error.error_subcode : null };
        throw error;
      }
      return response.json();
    };
    // Read the configured phone directly; do not guess IDs from display numbers.
    const [phone, subscriptions, numbers] = await Promise.all([
      get(`${env.WHATSAPP_PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name`, 'phone'),
      get(`${env.WHATSAPP_WABA_ID}/subscribed_apps?limit=100`, 'subscription'),
      get(`${env.WHATSAPP_WABA_ID}/phone_numbers?fields=id&limit=100`, 'account'),
    ]);
    if (!Array.isArray(subscriptions.data) || !Array.isArray(numbers.data) || typeof phone.display_phone_number !== 'string' || phone.id !== env.WHATSAPP_PHONE_NUMBER_ID) throw new Error('INVALID_META_RESPONSE');
    const app = subscriptions.data.find(item => item.whatsapp_business_api_data?.id === env.WHATSAPP_APP_ID);
    result.meta = {
      state: 'checked', phoneMatches: phone.display_phone_number.replace(/\D/g, '') === EXPECTED_BUSINESS_PHONE,
      displayPhone: phone.display_phone_number,
      subscribed: app ? true : subscriptions.paging?.next ? null : false,
      hasCallbackOverride: Boolean(app?.override_callback_uri),
      phoneBelongsToAccount: numbers.data.some(item => item.id === phone.id) ? true : numbers.paging?.next ? null : false,
    };
  } catch (error) { result.meta = { state: 'unavailable', ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}) }; }
  return result;
}

export async function subscribeWhatsAppConnection(env, fetcher = fetch) {
  const before = await inspectWhatsAppConnection(env, fetcher, true);
  if (!before.enabled || before.missing.length || before.testSender || before.meta.state !== 'checked' || !before.meta.phoneMatches || before.meta.phoneBelongsToAccount !== true) throw new Error('CONNECTION_NOT_READY');
  if (before.meta.subscribed === true) return before;
  if (before.meta.subscribed !== false) throw new Error('SUBSCRIPTION_UNCONFIRMED');
  // POST subscribes the token's app, so verify that identity before mutation.
  const debugUrl = new URL(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/debug_token`);
  debugUrl.searchParams.set('input_token', env.WHATSAPP_ACCESS_TOKEN);
  const debugResponse = await fetcher(debugUrl, { headers: { Authorization: `Bearer ${env.WHATSAPP_APP_ID}|${env.WHATSAPP_APP_SECRET}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!debugResponse.ok) throw new Error('TOKEN_CHECK_FAILED');
  const debug = (await debugResponse.json()).data;
  if (debug?.is_valid !== true || String(debug.app_id) !== env.WHATSAPP_APP_ID) throw new Error('TOKEN_APP_MISMATCH');
  // Do not POST over an existing subscription: it can reset callback overrides.
  const response = await fetcher(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_WABA_ID}/subscribed_apps`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || (await response.json()).success !== true) throw new Error('SUBSCRIPTION_FAILED');
  const after = await inspectWhatsAppConnection(env, fetcher, true);
  if (after.meta.subscribed !== true) throw new Error('SUBSCRIPTION_UNCONFIRMED');
  return after;
}

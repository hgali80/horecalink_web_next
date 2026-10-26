import { inspectWhatsAppConnection } from '../app/lib/server/whatsappConnectionCore.mjs';

// Run with hosting secrets supplied as environment variables. Never print tokens.
// Default: read-only. --subscribe only adds a missing WABA app subscription.
const status = await inspectWhatsAppConnection(process.env, fetch, true);
console.log(JSON.stringify(status, null, 2));
const meta = status.meta;
if (!status.enabled || status.missing.length || status.testSender || meta.state !== 'checked' || !meta.phoneMatches || meta.phoneBelongsToAccount !== true) {
  console.error('Kurulum tamamlanmadı. +7 700 444 69 11 için sunucu ve Meta ayarlarını düzeltin.');
  process.exitCode = 1;
} else if (process.argv.includes('--subscribe') && meta.subscribed === false) {
  // A POST may remove an override; only run when this app has NO subscription.
  try {
    // A messaging token can belong to a different app. Verify its identity
    // before POST, which always subscribes the app associated with that token.
    const debugUrl = new URL(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION}/debug_token`);
    debugUrl.searchParams.set('input_token', process.env.WHATSAPP_ACCESS_TOKEN);
    const debugResponse = await fetch(debugUrl, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_APP_ID}|${process.env.WHATSAPP_APP_SECRET}` }, signal: AbortSignal.timeout(10000),
    });
    if (!debugResponse.ok) throw new Error('TOKEN_CHECK_FAILED');
    const debug = (await debugResponse.json()).data;
    if (debug?.is_valid !== true || String(debug.app_id) !== process.env.WHATSAPP_APP_ID) throw new Error('TOKEN_APP_MISMATCH');
    const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION}/${process.env.WHATSAPP_WABA_ID}/subscribed_apps`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || (await response.json()).success !== true) throw new Error('SUBSCRIPTION_FAILED');
    const verified = await inspectWhatsAppConnection(process.env, fetch, true);
    if (verified.meta.subscribed !== true) throw new Error('SUBSCRIPTION_UNCONFIRMED');
    console.log('WhatsApp hesap aboneliği kuruldu ve tekrar okunarak doğrulandı. Yeni gelen mesajla teslimat testi hâlâ gerekli.');
  } catch {
    console.error('Abonelik doğrulanamadı. İşlemi tekrarlamadan önce Meta bağlantısını yeniden kontrol edin.');
    process.exitCode = 1;
  }
} else {
  console.log(meta.subscribed === true ? 'Hesap aboneliği mevcut. Meta callback/messages ayarlarını ve yeni gelen mesajı doğrulayın.' : 'Abonelik doğrulanmadı. Eksik aboneliği kurmak için --subscribe kullanın.');
  if (meta.subscribed !== true) process.exitCode = 1;
}

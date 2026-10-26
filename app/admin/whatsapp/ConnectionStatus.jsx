'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export default function ConnectionStatus({ readInbox }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  const check = useCallback(async (meta = false) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError('');
    try {
      const result = await readInbox(`/api/admin/whatsapp/connection${meta ? '?meta=1' : ''}`, request.signal);
      if (!request.signal.aborted) setStatus(result);
    } catch (err) { if (!request.signal.aborted) { setStatus(null); setError(err.message); } }
    finally { if (!request.signal.aborted) setBusy(false); }
  }, [readInbox]);
  useEffect(() => { check(); return () => controller.current?.abort(); }, [check]);
  return <section aria-label="WhatsApp bağlantısı" className="rounded-xl border bg-slate-50 p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">İşletme numarası: +7 700 444 69 11</h2><button type="button" disabled={busy} onClick={() => check(true)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">{busy ? 'Kontrol ediliyor...' : 'Meta bağlantısını kontrol et'}</button></div>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {status && <div className="mt-2 space-y-2">
      {!status.enabled && <p className="text-red-700">Mesaj alımı sunucuda kapalı.</p>}
      {status.missing.length > 0 && <p className="text-red-700">Bağlantı ayarları eksik. Yayın ortamındaki WhatsApp ayarları tamamlanmalı.</p>}
      {status.testSender && <p className="text-red-700">Panel hâlâ Meta test numarasına bağlı. İşletme numarasına gelen mesajlar bu bağlantıyla alınamaz.</p>}
      <p>Son kaydedilen gelen mesaj: {status.lastIncomingAt ? new Date(status.lastIncomingAt).toLocaleString('tr-TR') : 'Henüz yok'}</p>
      {status.meta.state === 'unchecked' && <p>Gerçek numara ve Meta aboneliği henüz kontrol edilmedi.</p>}
      {status.meta.state === 'missing' && <p className="text-amber-800">Meta kontrolü için sunucu ayarları eksik. Yöneticiye iletilecek alanlar: {status.meta.missing.join(', ')}</p>}
      {status.meta.state === 'invalid' && <p className="text-red-700">Meta hesap ayarlarının biçimi geçersiz.</p>}
      {status.meta.state === 'unavailable' && <p className="text-red-700">Meta kontrolü başarısız. Erişim anahtarı, hesap izinleri ve bağlantı kontrol edilmeli.</p>}
      {status.meta.diagnostics && <p className="text-red-700">Kontrol: {({phone: 'Numara erişimi', subscription: 'Hesap aboneliği', account: 'Hesap erişimi'})[status.meta.diagnostics.stage]} · HTTP {status.meta.diagnostics.httpStatus} · Meta kodu {status.meta.diagnostics.code ?? 'yok'} / {status.meta.diagnostics.subcode ?? 'yok'}</p>}
      {status.meta.state === 'checked' && <>
        <p className={status.meta.phoneMatches ? '' : 'text-red-700'}>Meta’da bağlı numara: {status.meta.displayPhone}{!status.meta.phoneMatches && ' — işletme numarasıyla eşleşmiyor.'}</p>
        {status.meta.phoneBelongsToAccount !== true && <p className="text-red-700">Numaranın yapılandırılmış WhatsApp işletme hesabına ait olduğu doğrulanamadı. Hesap ve numara kimlikleri kontrol edilmeli.</p>}
        <p className={status.meta.subscribed === true ? '' : 'text-red-700'}>{status.meta.subscribed === true ? 'Uygulama WhatsApp hesabına abone.' : status.meta.subscribed === false ? 'Uygulama WhatsApp hesabına abone değil. Meta hesap aboneliği kurulmalı.' : 'Hesap aboneliği doğrulanamadı.'}</p>
        {status.meta.hasCallbackOverride && <p className="text-amber-800">Hesapta özel mesaj iletim adresi var; doğru siteye yönlendirdiği kontrol edilmeli.</p>}
        <p>Bu kontrol mesaj teslimatını doğrulamaz. Meta’da “messages” aboneliği ve bu siteye iletim adresi doğrulanmalı; ardından işletme numarasına yeni mesaj gönderilmeli.</p>
      </>}
    </div>}
  </section>;
}

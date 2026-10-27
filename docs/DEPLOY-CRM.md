# HorecaLink CRM — deploy teslim notu

Bu teslim yerel kod paketidir. Deploy işlemini kullanıcı yapar. Yeni çalışma bayrakları kendiliğinden açılmaz; mevcut Vercel/Firebase/Meta/OpenAI anahtarları değiştirilmedi.

## Tekrarlanabilir kontrol komutları

- `npm run test:crm`: Dört aşamanın izole testleri; gerçek müşteri, FCM, Meta veya ücretli AI çağrısı yoktur.
- `npm run lint:crm`: CRM ile ilgili JS/JSX ve test dosyalarının kod kontrolü.
- `npm run build`: Mevcut Next.js üretim derlemesi. Projedeki mevcut `ignoreBuildErrors` ayarı korunmuştur; TypeScript kontrolü ayrı bir garantimiz değildir.
- `npm run verify:crm`: Test + CRM kod kontrolü + standart üretim derlemesi.
- `npm run check:crm`: Yalnızca yerel ayarların varlığını ve açık/kapalı durumunu gösterir; anahtar değerlerini yazdırmaz, canlı ayarları doğrulamaz.

## Vercel ayarları

Mevcut Firebase Admin, Meta ve OpenAI değerlerini koru. Bunları kod deposuna veya sohbete yazma. Yeni isimlerin boş/kapalı örneği `crm-runtime.env.example` dosyasında.

| Ayar | Kullanımı |
| --- | --- |
| `CRM_AUTOMATION_ENABLED=true` | Hazır olduğunda günlük takip taramasını açar. |
| `CRON_SECRET` | En az 32 karakterlik güçlü ve gizli bir değer olmalı. Vercel cron çağrısının kimliğini doğrular. |
| `CRM_BROWSER_PUSH_ENABLED=true` | Firebase Web Push hazırlandıktan sonra tarayıcı kaydı ve bildirim gönderimini açar. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Firebase Console → Cloud Messaging → Web Push sertifikalarındaki **açık** anahtar. Özel anahtar burada kullanılmaz. |
| `WHATSAPP_TEMPLATE_SEND_ENABLED=true` | Meta’da uygun şablon onayı ve test alıcısı hazır olduğunda onaylı şablon gönderimini açar. Mevcut `WHATSAPP_SEND_ENABLED=true` de gerekir. |

Mevcut WhatsApp bağlantısının `WHATSAPP_INBOX_ENABLED`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_WABA_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` ve `WHATSAPP_GRAPH_API_VERSION` ayarlarını Vercel’de doğrula. Katalog kimlik bilgilerini mesajlaşma kimlik bilgileriyle değiştirme. AI için mevcut `WHATSAPP_DRAFTS_ENABLED`, `OPENAI_API_KEY`, `OPENAI_MODEL` ayarları kullanılır; model kendiliğinden değiştirilmedi.

`vercel.json`, Hobby planı için günde bir kez `0 4 * * *` kontrolünü içerir: Kazakistan saatiyle 09.00–09.59 aralığı. Gün içinde belirli dakikada alarm veya saatlik kontrol değildir. Daha sık aralık ayrıca planlanmalıdır. İşlem başına ortak süre bütçesi ve sayfa sınırı vardır; büyük kuyruklar panelde kalan iş olarak gösterilir.

## Firebase ve tarayıcı bildirimi

Firebase Cloud Messaging HTTP v1 API ve mevcut Admin hesabının mesajlaşma yetkisini doğrula. Web Push açık anahtarını Vercel’e ekle. Ayrı bildirim worker’ı `/firebase-messaging-sw.js`, `/crm-push/` kapsamında çalışır; mevcut çevrimdışı `/sw.js` korunur.

Yönetici oturumuyla **Müşteri Takibi → Tarayıcı bildirimini aç** seçilip tarayıcı izni verilmelidir. Sadece deploy yapmak cihazı bildirim için kaydetmez. Bildirim içeriğinde müşteri adı/telefonu/mesajı yoktur. Kapatma ve çıkış yapma, devam eden kayıt isteklerini de iptal eder. Bildirim sağlayıcısının kabulü, işletim sisteminin bildirimi gösterdiğinin kanıtı değildir.

Firestore TTL ayarlarını ayrı uygula: `crm_notifications` ve `whatsapp_delivery_receipts` için `expiresAt` (90 gün), `crm_push_subscriptions` için `expiresAt` (14 gün); mevcut inbox ve kota koleksiyonlarının TTL ayarlarını da koru. Görev, izin ve alt koleksiyonlardaki denetim kayıtlarının saklama süresini ayrıca belirle. Yeni koleksiyonlar yalnızca yetkili sunucu API’lerinden kullanılır; mevcut varsayılan ret kuralları korunur. Onaylanan TTL kuralları bulutta uygulandı; güvenlik kuralları değiştirilmedi. Güncel durum aşağıdaki bulut ayarları bölümündedir.

## Deploy sonrası kısa kabul kontrolü

1. Yönetici hesabıyla takip oluştur, tarihi değiştir, tamamla ve yeniden aç. Yetkisiz hesabın veriye erişemediğini doğrula.
2. Kendi test görüşmeni, ürününü ve teklifini bağla; görsel kartı önizle. Gerçek müşteri yerine izinli test alıcısını kullan.
3. Takip mesajı iznini kaydet/geri çek; izin yokken gönderimin engellendiğini doğrula. Meta’daki onaylı metin şablonunun alanlarını ve alıcıyı açıkça onaylayarak test et.
4. Tarayıcı bildirimini aç; panel açıkken ve kapalıyken kendi cihazında dene. Kapatma ve çıkış yapmanın kaydı sonlandırdığını doğrula.
5. Günlük kontrolün çalıştığını paneldeki son kontrol bilgisinden izle. Aynı görevde yinelenen bildirim oluşmadığını; yeni yanıtla eski takibin durakladığını doğrula. Sadece satış taslağı açılınca görev tamamlanmamalı; gerçek bağlı ERP satışı onaylanmalı.
6. Açıkça onaylanmış test mesajında Meta’nın imzalı gönderildi/teslim/okundu olaylarını doğrula. Sonucu belirsiz bir gönderimi tekrar göndermeden araştır.

Bu gerçek servis/cihaz adımları, yerel test veya derleme ile yapılmış sayılmaz. Kod bunlara hazırdır; canlı hesap ayarları ve sağlayıcı davranışı deploy ortamında doğrulanır. Otomasyon müşteriye kendiliğinden mesaj göndermez.

Ayrıntılı teknik davranışlar: `crm-automation.md`, `whatsapp-followups.md`, `whatsapp-product-sharing.md`, `crm-followups.md`.

## Teslim doğrulaması

Son sürümde 57 test, `npm run lint:crm`, tam üretim derlemesi (322 sayfa) ve 9 yerel üretim HTTP kontrolü başarılı. Son kontroller, uzun bildirim kuyruğunun devam etmesini, ortak işlem bütçesini ve bildirim kapatılırken devam eden kayıt işleminin yeniden etkinleşememesini de kapsar. Derlemenin geçici TypeScript yol değişiklikleri temizlendi.

Yerel kod paketi deploy için hazırdır. Deploy işlemi yapılmadı. Gerçek hesap oturumu, cihaz bildirimi ve Meta gönderim/teslim doğrulaması bu kod kontrolleriyle yapılmış sayılmaz; yukarıdaki ortam ayarları ve kısa kabul kontrolü bunun için vardır.

## Bulut ayarları — 27 Ekim 2026

Firebase projesi: `horecakatalog-e2d10`. Kullanıcının açık onayıyla yedi koleksiyon grubunda `expiresAt` TTL kuralları uygulandı ve tamamının `ACTIVE` olduğu tekrar okunarak doğrulandı: whatsapp_conversations, messages, whatsapp_reply_limits, whatsapp_card_limits, whatsapp_delivery_receipts, crm_notifications, crm_push_subscriptions. Müşteri kartları, teklifler, takip görevleri ve izin kayıtları kapsam dışında. Normal sohbet mesajlarında expiresAt bulunmadığı ön taramada doğrulandı.

FCM, FCM Registration, Firebase ve Firestore API’leri açık. Mevcut Firebase Admin hesabının FCM mesajlaşma yetkisi doğrulandı; yeni IAM rolü eklenmedi.

Vercel ekip erişimi onaylandı; `horecalink-web-next` projesinin `horecalink.kz` alan adına ait olduğu doğrulandı. Yalnızca production ortamına dört eksik ayar eklendi ve tekrar okunarak doğrulandı:

- `CRON_SECRET`: 48 rastgele bayttan üretilen gizli değer; sensitive olarak saklandı.
- `CRM_AUTOMATION_ENABLED=true`: panel içi günlük takip kontrolü.
- `CRM_BROWSER_PUSH_ENABLED=true`: kullanıcı tarafından Firebase’den sağlanan VAPID açık anahtarı eklendi. Anahtarın P-256 biçimi ve Vercel’deki değer eşleşmesi doğrulandı.
- `WHATSAPP_TEMPLATE_SEND_ENABLED=false`: uygun onaylı Meta şablonu doğrulaması bekleniyor.

Mevcut WhatsApp, katalog, OpenAI ve Firebase değerleri değiştirilmedi. Yeni ayarlar bir sonraki deploy ile uygulanır; deploy yapılmadı. Hobby günlük cron tanımı yerel vercel.json içinde hazırdır; yeni sürüm deploy edilmeden bu cron etkin sayılmaz. Firebase Web Push açık anahtarı Vercel production ortamına eklendi. Anahtarın Firebase kaydı ve gerçek cihaz teslimi ancak deploy sonrası tarayıcı aboneliği ile doğrulanabilir. Gerçek cihaz ve Meta kabul kontrolleri tamamlanmadı. Otomasyon kendiliğinden müşteriye WhatsApp mesajı göndermez.

Gizli değer içermeyen raporlar: firebase-cloud-settings-status.json ve firebase-cloud-ttl-status.json.

Tarayıcı bildirimi ayarları güncellemesi: `NEXT_PUBLIC_FIREBASE_VAPID_KEY` production ortamında mevcut ve sağlanan açık anahtarla birebir eşleşiyor; `CRM_BROWSER_PUSH_ENABLED=true` tekrar okunarak doğrulandı. Deploy ve gerçek bildirim gönderimi yapılmadı. Deploy sonrası yönetici panelinde Müşteri Takibi → Tarayıcı bildirimini aç adımı gerekir.

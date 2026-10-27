# HorecaLink CRM — yerel kurulum durumu

Dört aşamanın kodu `C:\Users\hasan\horecalink_web_next` içine eklendi. Canlıya alma, Vercel/Firebase/Meta ayarı değiştirme veya gerçek müşteriye mesaj/bildirim gönderme yapılmadı.

## Eklenenler

1. **Takip temeli:** Müşteri–teklif–WhatsApp bağlantıları, tarihli görevler, bugün/geciken filtreleri, erteleme, kapatma ve yeniden açma.
2. **Ürün paylaşımı:** Ürün linki, görsel kart ve görsel + link; önizleme ve fiyatı göster/gizle seçeneği.
3. **Takip mesajları:** AI taslağı, gerçek müşteri izninin kaydı ve iptali, Meta’da onaylı metin şablonlarını inceleyerek gönderme desteği. Gönderim insan onayına bağlı.
4. **Kontrollü otomasyon:** Günlük arka plan taraması, görev sahibine özel panel/tarayıcı bildirim altyapısı, yeni müşteri yanıtında eski teklif/sessiz müşteri takibini duraklatma, gerçek ERP satışı onaylanınca ilgili takibi tamamlama ve imzalı WhatsApp teslim durumları.

Satış taslağı tamamlanmış satış sayılmaz. Planlı geri arama görevleri, müşteri yazdı diye kendiliğinden iptal edilmez. Otomasyon müşteriye kendiliğinden mesaj göndermez.

## Doğrulananlar

- 57 otomatik test başarılı; veritabanı, Meta, OpenAI ve FCM çağrıları testlerde taklit edildi.
- Değişen JS/JSX dosyalarında kod kontrolü başarılı.
- Ayrı kontrol klasöründe tam üretim derlemesi başarılı; 322 sayfa üretildi. Projenin mevcut ayarı tip doğrulamasını atlıyor; bu ayar değiştirilmedi.
- Derlenmiş uygulamada 9 yerel HTTP kontrolü başarılı: CRM ve WhatsApp sayfaları, korumalı API’lerin oturumsuz erişimi reddetmesi, kapalı zamanlayıcı/webhook ve ayrı bildirim servisi dosyası.
- Derleme aracının eklediği geçici TypeScript yapılandırma değişiklikleri kaldırıldı. Mevcut dosyaların yedekleri `.local-backups` altında.

Oturum açılmış gerçek bir yöneticinin uçtan uca ekran kullanımı, gerçek cihazda arka plan bildirimi ve canlı WhatsApp gönderim/teslim testi henüz yapılmadı.

## Hobby planına uygun çalışma

Kullanıcının seçimi: **tarayıcı bildirimi + panel içi bildirim**, Vercel **Hobby**.

Yerel `vercel.json`, günlük kontrolü 04.00 UTC / Kazakistan saatiyle 09.00 için tanımlar. Hobby hassasiyeti nedeniyle beklenen tetikleme 09.00–09.59 aralığıdır. Bu yapı bir dakika hassasiyetinde alarm değildir. Daha sık kontrol için ayrı bir zamanlayıcı veya uygun hosting planı gerekir; böyle bir servis kurulmadı ve ücretli plana geçilmedi.

## Canlıya geçmeden önce kalanlar

- Mevcut Vercel ortam ayarlarını, canlı WhatsApp bağlantısını ve onaylı metin şablonlarını güvenli biçimde doğrulamak.
- FCM API/Web Push VAPID ayarını hazırlamak; ilgili çalışma bayraklarını ve en az 32 karakterlik `CRON_SECRET` değerini barındırma ortamında ayarlamak. Anahtarlar sohbete yapıştırılmamalı.
- Firebase’de belirtilen bildirim, abonelik ve teslim kaydı koleksiyonlarının saklama/TTL ayarlarını ayrıca uygulamak.
- Yetkili test hesabıyla görev oluşturma, erteleme, duraklatma/yeniden açma, izin iptali, tarayıcı bildirimi açma/kapatma ve çıkış yapma akışlarını denemek.
- Açıkça onaylanmış bir test alıcısına gönderim ve imzalı teslim/okundu olayını doğrulamak.
- Ardından kullanıcının canlıya alma kararını uygulamak.

Yerel çalışma ayarlarının eksik olması, canlı Vercel ortamında çalışan bağlantının eksik olduğunu göstermez. Canlı ortam bu kurulum sırasında incelenmedi veya değiştirilmedi.

Ayrıntılar: `crm-followups.md`, `whatsapp-product-sharing.md`, `whatsapp-followups.md`, `crm-automation.md`. Ayar isimleri: `crm-runtime.env.example`. Yerel ve salt okunur ayar kontrolü: `node scripts/check-crm-readiness.mjs`.

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

## Bağlı kayıt seçimi düzeltmesi

Cari, teklif ve WhatsApp seçimleri formun altında ekran dışında açılmak yerine yerel modal pencerede açılıyor. Pencerede türe özel başlık, yükleme, boş liste, hata ve yeniden deneme durumları var. Kapatılan pencerede devam eden istek iptal ediliyor; 15 saniye sonra yükleme zaman aşımı gösteriliyor.

Değişen sayfa: app/satissitok/admin/crm/page.jsx. ESLint ve git diff --check başarılı. Gerçek sayfa bileşeni, sahte oturum/API ile Edge üzerinde test edildi: üç kayıt türü açma/seçme, mevcut form değerlerinin korunması, boş liste, hata/yeniden deneme, Escape ve Kapat, masaüstü ve 390 piksel mobil görünüm. Canlı oturum veya API testi ve deploy yapılmadı.

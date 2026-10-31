# Merkezi yayın sistemi — yerel kurulum

Bu değişiklikler henüz dağıtılmadı. Varsayılan: önce onay, duraklatılmış yayınlar ve kapalı sunucu yayın motoru. Geliştirme/test sırasında canlı gönderi, Firestore/Storage kaydı veya Meta hesabı değişikliği yapılmaz.

## Ekran ve davranış

`/admin/social`, yönetim panelindeki Yayın Merkezi kartından açılır. Aktif admin/super_admin yetkisi hem arayüzde hem API'de denetlenir. Ürün listesi 50'şer yüklenir; arama yüklenen ürünlerde çalışır. Son 50 yayın, 200 kanal işi ve 100 olay görüntülenir.

Her taslakta ürün, dört bağımsız kanal, Almatı (UTC+5) yayın zamanı, Facebook/Instagram metinleri ve her kanal için webden/PC'den görsel seçilir. Tek özel görsel desteklenir; video, Reels, carousel ve WhatsApp müşteri mesajı bu sürümde yoktur. JPEG/PNG/WebP en fazla 10 MB ve 40 milyon piksel; sunucu JPEG 1080×1350 türevi oluşturur ve metadata'yı çıkarır. Özel taslaklar `social_media` altında private tutulur; önizleme yetkili sunucu API'sinden alınır. Yayın anında Meta'ya altı saatlik okuma URL'si verilir. Web/WhatsApp için onaylı görsel mevcut public `product_images` alanına kopyalanır. Web seçimi `image_names` alanını değiştirir; WhatsApp seçimi ayrı `whatsapp_image_names` alanını kullanır. Web görseline dönüş WhatsApp override alanını kaldırır.

Önce onay modunda taslak `pending_approval` olur. Önizlemede görülen içeriğe onay verilir ve kanal başına tekil iş oluşturulur. Otomatik mod, yeni hazırlanıp tarih seçilerek kaydedilen taslağı ayrıca onay beklemeden takvime alır; kendiliğinden katalogdan ürün seçmez ve tekrar eden yayın üretmez. İçerik düzeltmek için başlamamış yayın iptal edilip yenisi oluşturulur; eski onay kullanılmaz. Global mod değişimi eski bekleyen taslakları onaylamaz.

Web işi ürünü webde görünür yapar; WhatsApp işi mevcut katalog senkronizasyonunu kullanır. Seçilmemiş kanallar ve eski gönderiler değiştirilmez. Ürünün genel aktiflik durumu açılmaz. Instagram/Facebook için tek fotoğraf gönderisi kullanılır.

## Güvenilirlik

`social_settings`, `social_posts`, `social_media_assets`, `social_publish_jobs`, `social_publish_logs` sadece Admin SDK ile yazılır. Mevcut yerel kurallarda default deny bunları kapsar; geniş bir recursive allow bulunan canlı kural varsa dağıtım öncesi ayrıca kontrol edilmelidir. Mevcut kurallar otomatik dağıtılmaz.

İş sahiplenme Firestore transaction ve 5 dakikalık lease kullanır. Süresi dolan `publishing` işi `needs_review` olur; kör tekrar yoktur. Onay revizyonu, içerik hash'i, ürün aktifliği, fiyat/teknik bilgi ve kaynak dosya generation'ları kontrol edilir. Değişmiş ürün veya görsel yayınlanmaz. Instagram container ID'si yayınlamadan önce saklanır; hazır olması sonraki çağrıda kontrol edilir. Facebook ve Instagram durumları ayrıdır. Uzak başarıyla yerel yazma arasında atomiklik yoktur; ağ zaman aşımı, süreç kesintisi ve bilinmeyen sonuç yönetici incelemesi gerektirir. İnceleme gereken yayınları uzaktan kontrol etmeden yeniden oluşturmayın.

Yeni API'ler erişim anahtarı veya ham Meta yanıtı loglamaz. İşçi bir çağrıda en fazla üç işi yürütür. İptal yalnızca henüz başlamamış yayınlarda mümkündür. Canlı başlatma öncesinde sandbox/emulator ile transaction yarışları ve yetkisiz API testleri de yapılmalıdır.

## Etkinleştirme için gerekenler

1. Kod incelemesi, yerel test/lint/build ve preview kabulü.
2. Mevcut Vercel Production secret'ları: `META_SOCIAL_ACCESS_TOKEN`, `META_SOCIAL_PAGE_ID`, `META_SOCIAL_INSTAGRAM_ID`. Son iki değer de Secret olabilir. `META_SOCIAL_GRAPH_API_VERSION=v26.0` mevcut katalog sürümüyle aynı varsayılandır; açık Config olarak eklenebilir.
3. `docs/social-publishing.indexes.json` içindeki iki indeks mevcut canlı indeksler korunarak ayrı eklenmeli; bu dosya firebase.json'a otomatik bağlanmadı. Hazır olmadan işçi çalıştırılmamalı.
4. Storage servis hesabının private medya için signed URL üretme yetkisi kontrol edilmeli.
5. Somut kapsam için kullanıcı onayıyla dağıtım. İlk dağıtımda `SOCIAL_PUBLISHING_ENABLED` kapalı kalmalı.
6. Ayrı onayla en az 32 karakterli `SOCIAL_CRON_SECRET` secret, `SOCIAL_PUBLISHING_ENABLED=true` Config ve `/api/jobs/social-publishing` için `Authorization: Bearer <SOCIAL_CRON_SECRET>` kullanan zamanlayıcı kurulmalı. Cron secret sohbete/loglara yazılmamalı. Vercel Hobby sık cron çalıştırma kısıtları için mevcut plan doğrulanmalı; ücretli plan açılmamalı. `vercel.json` değiştirilmedi.
7. Yayın merkezinden sınırlı test taslağı; seçilmiş içerik ve hedef için açık canlı yayın onayı; global duraklatmayı kaldırma; kanal sonuçlarını kontrol.

Meta kimlik testi daha önce kullanıcı bilgisayarında salt okunur başarılı oldu. Yeni provider adapter için bu geliştirmede gerçek yayın testi yapılmadı; Meta'nın güncel izin/giriş gereksinimleri canlı etkinleştirmeden önce resmi belgeler ve kontrollü yayınla doğrulanmalı. Yayın tokeninin 60 günlük sona erişi için yenileme süreci ayrıca kurulmalı.

## Yerel doğrulama

`node --test scripts/test-social-publishing.mjs scripts/test-social-transactions.mjs scripts/test-social-worker.mjs scripts/test-whatsapp-catalog.mjs scripts/test-whatsapp-sync.mjs`

`npm run build`

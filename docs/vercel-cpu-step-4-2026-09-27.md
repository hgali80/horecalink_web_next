# 4. adım — Ürün görsel listesini önceden hazırlama

## Uygulanan değişiklik

- Public ürün sayfası/metadata yükleyicisi artık Storage dosyalarını listelemez. `productImages.js` yalnız kayıtlı `image_names` listesini normalize eder; Firebase Admin bağımlılığı bu çağrı yolundan kaldırıldı.
- Ortak görsel adı ve envanter eşleştirmesi `app/lib/productImageNames.mjs` içinde tutulur. Ürün kodlarının birbirine karışmaması, numaralı fotoğrafların sırası ve farklı uzantılar korunur.
- Excel import, yazma işleminden önce Storage envanterini bir kez yükler ve ürünlerin görsel listelerini hazırlar. Storage okunamazsa eksik görsel listesi yazmak yerine import yazma işleminden önce durur.
- Admin ürün düzenleme ekranının mevcut fotoğraf yükleme/kaydetme akışı görsel adlarını zaten kaydeder; bu davranış değiştirilmedi.

## Tamamlanan canlı veri aktarımı

- 1.450 ürün ve 1.931 Storage nesnesi incelendi.
- 1.221 ürünün `image_names` alanına toplam 1.386 eksik görsel referansı eklendi.
- Yalnız `image_names` alanı güncellendi. Fotoğraf dosyaları silinmedi; fiyatlar ve diğer alanlar değiştirilmedi.
- Yazmalar 200'lük batch'ler ve belge `lastUpdateTime` önkoşuluyla yapıldı. İşlem 1.221/1.221 başarıyla tamamlandı.
- Yazma öncesi eski/yeni görsel listeleri yerel yedeğe kaydedildi:
  `.local-backups/product-images/2026-09-27T11-22-09-322Z.json`.
- `.local-backups/` Git dışında tutulur; yedek dosyasının ignore edildiği doğrulandı.

## Kontroller

- 1.450 ürünün tamamında envanter eşleştirmesinin önceki Storage keşfiyle aynı listeyi ve sırayı ürettiği salt-okunur testle doğrulandı.
- Yerel testler: kayıtlı liste/fallback, uzantılar, sıralama, kod çakışmaları, tekrar çalıştırma tutarlılığı, import başına tek envanter yükleme ve Storage hatasında sıfır yazma başarılı.
- Değişen 4. adım kodu ve test/maintenance dosyalarında ESLint başarılı.
- Production build başarılı: 70/70 statik sayfa üretildi.
- `git diff --check` başarılı.
- Aktarım sonrası salt-okunur dry-run: 1.450 ürün, 1.931 Storage nesnesi; `changedProducts: 0`, `addedReferences: 0`. Eksik referans kalmadı; tekrar çalıştırma ek değişiklik üretmiyor.

## Kullanım ve sınırlar

- `node scripts/sync-product-image-names.mjs` yalnız eksikleri raporlar.
- `node scripts/sync-product-image-names.mjs --apply` önce yedek alır, sonra görsel listelerini günceller.
- Fotoğraflar admin paneli yerine doğrudan Storage'a yüklenirse listelerin güncellenmesi için bu bakım komutu veya yeni import akışı kullanılmalıdır.
- Public tarayıcı galerisindeki görsel yükleme/probe davranışı bu adımda değiştirilmedi; bu davranış Vercel sunucusunda Storage listelemesi değildir.
- Veritabanı aktarımı canlıya uygulanmıştır. Kod henüz deploy edilmemiştir; sunucu CPU kazanımı yeni kod yayınlandıktan sonra başlar.
- ISR/ziyaretler arası ürün cache'i 5. adımın konusudur.

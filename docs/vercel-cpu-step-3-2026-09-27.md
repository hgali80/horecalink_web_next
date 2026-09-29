# 3. adım — İlgili ürün ve varyant sorguları

## Değişiklik

- İlgili ürünlerde tüm yayınlanmış katalog yerine bağlantı kodları ve gerektiğinde aynı grup/kategori sorgulanır.
- Aile varyantları, açık `productFamilyKey` alanıyla ve yerel aile eşleştirmesindeki SKU/ID listeleriyle bulunur. Eski kayıtlar için veri göçü gerekmez.
- `in` ve `array-contains-any` sorguları en fazla 30 benzersiz değer içerir.
- Birden fazla sorgunun getirdiği aynı belge normalizasyondan önce tekilleştirilir.
- Aktif/yayınlanmış filtreleri tüm sorgularda korunur. Aile geçersiz kılmaları, ürün URL'leri, kart gruplama ve sıralama korunur.
- Sıralama ve aile kartı sayıları değişmesin diye sorgulara rastgele bir limit eklenmedi; kapsam daraltıldı. Büyük kategorilerde kalan okuma yükü sonraki cache adımının konusudur.
- Veritabanına yazılmadı, indeks oluşturulmadı ve deployment yapılmadı.

## Doğrulama

Canlı veriden salt-okunur alan kontrolü: 1.439 yayınlanmış ürünün hepsinde bağlantı kodları dizi biçiminde ve kategori/grup alanları dolu. 185 üründe açık aile anahtarı bulunuyor. Mevcut kayıtların SKU'ları ID'leriyle aynı; kod ileride farklı olmalarını da destekliyor.

Kategori, bağlantı dizisi, aile, SKU ve document ID sorgu biçimleri mevcut Firestore indekslerine karşı sınırlı okumalarla doğrulandı.

`scripts/test-product-detail-queries.mjs`:

- Sentetik örneklerde 30'dan fazla sorgu değeri, gizli/pasif ürünler, farklı SKU/ID, eksik SKU, açık aile geçersiz kılması, çapraz kategori bağlantısı ve tekilleştirme test edildi.
- `--live` seçeneği ile yayınlanmış katalog bir kez okundu. Sonrasında tüm ürünler için eski ve yeni sorgu sonuçları yerelde karşılaştırıldı; ID'lerle sınırlı kalmadan tam sonuç, sıralama ve aile kartı sayıları eşleşti.
- 3 test başarılı. Mevcut `test-product-families.cjs` testi de başarılı.
- Değişen iki uygulama dosyası ve yeni test dosyasında ESLint başarılı.
- `npm run build` başarılı (70/70 statik sayfa). Ürün detayının rendering türü bu adımda hâlâ dinamik; ISR daha sonraki adımda uygulanacak.
- `git diff --check` başarılı. Önceden kaydedilmiş genel lint/tip sorunları bu değişikliğin kapsamına alınmadı.

## Kapsam karşılaştırması

Her yayınlanmış ürünün ilgili ürün/varyant hesabının bir kez çalıştığı yerel simülasyonda:

| Ölçü | Değer |
| --- | ---: |
| Ürün sayısı | 1.439 |
| Eski sorguların toplam döndürdüğü belge sayısı | 2.345.570 |
| Yeni sorguların toplam döndürdüğü belge sayısı (tekilleştirme öncesi) | 88.952 |
| Yeni sorgu sayısı (yerel simülasyon) | 2.919 |

Belge sonuç hacmi yaklaşık %96,2 azalır. Bu gerçek trafik dağılımı, faturalandırılan Firestore read veya Vercel CPU tasarruf yüzdesi değildir. Boş sorguların minimum okuma ücretleri ve SDK/istek maliyetleri bu sayılarda yer almaz. 2.919 sorgu canlı veritabanında çalıştırılmadı; karşılaştırma bellekte yapıldı.

Kalıcı cache, ISR ve görsel keşfinin kaldırılması bu adımda uygulanmadı.

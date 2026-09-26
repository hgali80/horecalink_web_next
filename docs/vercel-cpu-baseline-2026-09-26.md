# Vercel CPU iyileştirmesi — 1. adım başlangıç kaydı

Tarih: 26 Eylül 2026

## Başlangıç

- Commit: `f1d26fc1435108ea9a837bedc1824b46fe0b7b73` (`General updates and improvements`).
- İnceleme başında Git çalışma ağacı temizdi.
- Node.js: 20.20.0; npm: 10.8.2; kurulu Next.js: 15.5.14.
- Uygulama kodu ve yapılandırması değiştirilmedi. Bu belge başlangıç sonuçlarını kaydeder.
- Deployment yapılmadı. Canlı Vercel CPU ölçümü alınmadı.

## Kontroller

| Kontrol | Sonuç |
| --- | --- |
| `npm run build` | Başarılı, çıkış kodu 0; 70/70 statik sayfa üretildi |
| `npm run lint` | Başarısız; mevcut 67 hata, 8 uyarı |
| `npx tsc --noEmit --incremental false` | Başarısız; mevcut 4 tip hatası |

İlk build denemesi sandbox içinde `spawn EPERM` ile durdu. Gerekli süreç başlatma izniyle tekrar çalıştırılan aynı komut başarıyla tamamlandı.

`next.config.js` build sırasında lint ve tip kontrolünü atlıyor. Bu nedenle başarılı build, lint ve tip hatalarının olmadığı anlamına gelmiyor. Ayrı kontroller otomatik düzeltme seçeneği olmadan çalıştırıldı.

### Mevcut tip hataları

- `app/catalog/[group]/layout.tsx:1`: `children` implicit any (TS7031).
- `app/catalog/layout.tsx:17`: `children` implicit any (TS7031).
- `app/products/layout.tsx:17`: `children` implicit any (TS7031).
- `app/context/LanguageContext.tsx:113`: `lang` alanının string tipi Language tipiyle uyuşmuyor (TS2322).

### Mevcut lint durumu

- `app/components/ProductGallery.jsx:102`: effect içinde senkron setState, `react-hooks/set-state-in-effect`.
- Diğer hatalar: yardımcı script/test dosyaları, `firebase/vatReport.js` ve `tmp/check-category.cjs` içindeki CommonJS require kullanımları (`@typescript-eslint/no-require-imports`).
- 8 uyarı: admin mesaj/kullanıcı ekranlarında hook bağımlılıkları; ürün düzenleme/teklif ekranlarında img; VAT ve locale script'lerinde kullanılmayan değişkenler.
- Bunlar optimizasyon öncesinde görülen bulgulardır; bu adımda düzeltilmedi.

## Güncel build rendering başlangıcı

| Route | Build sonucu |
| --- | --- |
| `/`, `/catalog`, `/products`, `/categories` | Statik |
| `/about`, `/contact`, `/shipping`, `/payment`, `/privacy`, `/return-policy` | Statik |
| `/teklif-talep`, `/teklif-talep/basarili`, `/usage-areas` | Statik |
| `/products/[slug]` | Dinamik |
| `/catalog/[group]`, `/catalog/[group]/[category]`, `/catalog/[group]/[category]/[subcategory]` | Dinamik |
| `/categories/[sub]`, `/usage-areas/[slug]`, `/teklifler/[id]` | Dinamik |
| `/production` | Statik |
| `/production/[group]`, `/production/[group]/[family]` | Bilinen yollar SSG |
| `/sitemap.xml`, `/sitemap-static.xml`, `/sitemap-products.xml`, `/sitemap-catalog.xml` | Dinamik handler |
| `/robots.txt` | Statik |
| 18 API route'u | Dinamik handler |

Bu sınıflandırma yerel production build çıktısıdır; canlı deployment cache hit oranını göstermez. Statik sayfaların browser içinden çağırdığı API işlemleri ayrıca server yükü oluşturabilir.

## 2. adım için doğrulanan tekrar

`app/products/[slug]/page.jsx` içindeki `generateMetadata` ve `ProductDetailPage`, `getProductBySlug(slug)` ile `hydrateProductImageNames(product)` fonksiyonlarını ayrı ayrı çağırıyor. Mevcut çağrı yolunda ortak request memoization bulunmuyor.

Sonraki adım: metadata ve sayfa için aynı ürün yüklemesini request içinde paylaşmak. Kalıcı cache/ISR ve sorgu kapsamını küçültme sonraki adımlardır.

## Ölçüm sınırları

Bu adım derlenebilirlik ve mevcut hata/rendering durumunu kaydeder. Tarayıcıdaki bütün kullanıcı akışları, canlı Firestore sorgu sayıları ve Vercel Active CPU süreleri ölçülmedi. CPU tasarruf yüzdesi çıkarılamaz.

# Cumhuriyet Günü açılış kutlaması

Yönetim Paneli → Bayram ve Özel Günler → Cumhuriyet Günü.

- Aktif et / Pasif et, üst şeridi, ana sayfa kartını ve tam ekran kutlamayı birlikte yönetir.
- Tam ekran önizle, canlı ayarı ve ziyaret geçmişini değiştirmeden açılır. Önizle bölümündeki dil seçimi tam ekran önizlemede de kullanılır.
- Tam ekran yalnızca ana sayfada, kutlama başına ve takvim yılı başına tarayıcı sekmesindeki ziyaret süresince bir kez görünür. Sayfa yenilemek gösterim kaydını silmez; yeni ziyaret için yeni bir sekme açılabilir.
- Ekrana tıklama/dokunma, devam düğmesi, kapatma düğmesi ve Escape ile kapanır. Odak diyalog içinde tutulur; sayfa kaydırması kapanınca geri gelir.
- Hareketi azaltma tercihi varsa animasyonlar durur.
- Metinler Kazakça, Rusça, Türkçe ve İngilizce olarak canlı HTML'dir.
- Görsel: `public/images/celebrations/republic-day-emblem.webp`, yaklaşık 80 KB, saydam alfa kanallı. Video veya ek animasyon kütüphanesi kullanılmaz.
- Yerel uygulamadır; bu çalışma kapsamında dağıtım yapılmadı ve canlı bayram ayarı değiştirilmedi.

## Görsel üretim kaydı

Built-in image_gen kullanıldı, transparent_background=true. Üretilen motif WebP olarak küçültüldü; metinler ve arka plan görsele işlenmedi.

Üretim istemi:

> A single isolated Kazakhstan national flag inspired GOLDEN SUN AND SOARING STEPPE EAGLE decorative emblem, transparent background, no text, no border, no mockup. For a premium Republic Day celebration web overlay. Centered symmetrical composition, golden circular sun above with 32 evenly spaced narrow droplet sunrays, below it a graceful steppe eagle silhouette with wings stretched broadly upward and outward, traditional Kazakhstan flag motif. Refined metallic champagne gold with subtly embossed satin finish and restrained highlights. Very sharp clean silhouette edges, generous transparent margins. No laurel wreath, no shield, no crown, no blue background, no additional objects, no confetti, no typography, no watermark. Front view, elegant iconic decorative national motif. Transparent background is essential.

## Kontrol

`npm run build`; ilgili JSX dosyalarında ESLint; `scripts/test-celebrations-ui.cjs`; `scripts/test-celebration-welcome.cjs`.

Tarayıcı testleri gerçek bayram verisine yazmaz. Playwright kurulu olmalıdır; kurulu Edge için `PLAYWRIGHT_CHANNEL=msedge` kullanılabilir. Tam ekran testi yerel production sunucusunu varsayılan olarak 3100 portunda bekler; `CELEBRATION_TEST_URL` ile değiştirilebilir.

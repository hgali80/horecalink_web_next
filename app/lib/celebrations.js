export const CELEBRATION_DEFAULTS = { activeId: null, revision: 0 };

export const CELEBRATIONS = [{
  id: 'republic-day', name: 'Cumhuriyet Günü', date: '25 Ekim',
  copy: {
    kz: { date: '25 қазан', title: 'Республика күні құтты болсын!', note: 'Бірлігіміз бекем, еліміз аман болсын!' },
    ru: { date: '25 октября', title: 'С Днём Республики Казахстан!', note: 'Желаем мира, единства и процветания!' },
    tr: { date: '25 Ekim', title: 'Kazakistan Cumhuriyet Günü kutlu olsun!', note: 'Barış, birlik ve refah dolu yarınlara.' },
    en: { date: '25 October', title: 'Happy Republic Day, Kazakhstan!', note: 'Wishing you peace, unity and prosperity.' },
  },
}];

export function normalizeCelebration(data) {
  return {
    activeId: CELEBRATIONS.some(item => item.id === data?.activeId) ? data.activeId : null,
    revision: Number.isSafeInteger(data?.revision) && data.revision >= 0 ? data.revision : 0,
  };
}

export function validateCelebrationUpdate(data) {
  if (!data || !Object.hasOwn(data, 'activeId') ||
      (data.activeId !== null && !CELEBRATIONS.some(item => item.id === data.activeId)) ||
      !Number.isSafeInteger(data.revision) || data.revision < 0) {
    throw new Error('Geçersiz kutlama ayarı. Sayfayı yenileyin.');
  }
  return { activeId: data.activeId, revision: data.revision };
}

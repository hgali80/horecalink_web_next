export const CAMPAIGN_ID = 'stainless-production-2026-11';
export const SESSION_KEY = `hl-welcome-showcase:${CAMPAIGN_ID}`;
export const STARTS_AT = Date.parse('2026-11-03T00:00:00+05:00');
export const ENDS_AT = Date.parse('2026-11-10T23:59:00+05:00');
export const SLIDE_DURATION_MS = 3000;

export function isCampaignActive(now = Date.now()) {
  return now >= STARTS_AT && now < ENDS_AT;
}

export function nextSlide(index, direction, count) {
  if (direction > 0 && index === count - 1) return null;
  return Math.max(0, Math.min(count - 1, index + direction));
}

let seenInMemory = false;
export function hasSeenShowcase() {
  if (seenInMemory) return true;
  try { return window.sessionStorage.getItem(SESSION_KEY) === 'seen'; }
  catch { return false; }
}

export function rememberShowcase() {
  seenInMemory = true;
  try { window.sessionStorage.setItem(SESSION_KEY, 'seen'); } catch {}
}

export function clearExpiredSession() {
  try { window.sessionStorage.removeItem(SESSION_KEY); } catch {}
}

const path = '/images/welcome-showcase/';
export const SLIDES = [
  {
    image: `${path}00-cover.webp`, title: 'От идеи до готового изделия',
    description: 'Изготовление оборудования из нержавеющей стали по индивидуальным проектам',
    photo: [0.275, 0.617],
    benefits: ['Консультация и задача', 'Проектирование и согласование', 'Собственное производство', 'Надёжная упаковка и доставка'],
  },
  {
    image: `${path}01-sketch.webp`, title: 'Эскиз по вашей идее',
    description: 'Быстро разрабатываем предварительный эскиз с учётом ваших требований',
    photo: [0.325, 0.85],
    benefits: ['Ваша задача или идея — наш старт к готовому решению'],
  },
  {
    image: `${path}02-drawing.webp`, title: 'Технический чертёж',
    description: 'Подготавливаем точный чертёж с размерами и деталями для согласования',
    photo: [0.35, 0.85],
    benefits: ['Согласовываем каждую деталь перед производством'],
  },
  {
    image: `${path}03-production.webp`, title: 'Производство',
    description: 'Изготавливаем оборудование на собственном производстве из качественной нержавеющей стали',
    photo: [0.325, 0.80],
    benefits: ['Современное производство', 'Контроль качества', 'Надёжные и долговечные конструкции'],
  },
  {
    image: `${path}04-shipping.webp`, title: 'Упаковка и отгрузка',
    description: 'Профессиональная упаковка и подготовка к безопасной доставке по Казахстану',
    photo: [0.325, 0.81],
    benefits: ['Надёжная упаковка', 'Защита при транспортировке', 'Готовность к отправке'],
  },
];

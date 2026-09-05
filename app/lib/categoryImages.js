import { categoryData } from '@/app/data/categoryData';
export const CATEGORY_GROUPS = ['institutional', 'equipment', 'paslanmaz'];
export const CATEGORY_COLORS = { institutional: '#16a34a', equipment: '#ea580c', paslanmaz: '#2563eb' };
export const categoryImageKey = (group, category) => `${group}--${category}`;
export function isCategoryImageKey(key) {
  return CATEGORY_GROUPS.some(group => Object.keys(categoryData[group].mainCategories).some(category => categoryImageKey(group, category) === key));
}
export async function readCategoryImagesResponse(response) {
  let data;
  try { data = await response.json(); } catch { throw new Error('Sunucu yanıtı okunamadı. Lütfen tekrar deneyin.'); }
  if (!response.ok) throw new Error(data.error || 'Görseller kaydedilemedi.');
  return data;
}

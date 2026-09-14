import { notFound } from 'next/navigation';
import ProductionPage from '../../../components/production/ProductionPage';
import { packagingFamilies } from '../../../lib/production';

export function generateStaticParams() { return packagingFamilies.map(item => ({ group: 'packaging', family: item.slug })); }
export async function generateMetadata({ params }) {
  const { group, family } = await params;
  const item = packagingFamilies.find(item => group === 'packaging' && item.slug === family);
  if (!item) return {};
  return { title: item.name.ru, description: item.description.ru, alternates: { canonical: `/production/packaging/${family}` } };
}
export default async function Page({ params }) {
  const { group, family } = await params;
  if (group !== 'packaging' || !packagingFamilies.some(item => item.slug === family)) notFound();
  return <ProductionPage group={group} familySlug={family}/>;
}

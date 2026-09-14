import { notFound } from 'next/navigation';
import ProductionPage from '../../components/production/ProductionPage';
import { productionCopy } from '../../lib/production';

export function generateStaticParams() { return [{ group: 'stainless' }, { group: 'packaging' }]; }
export async function generateMetadata({ params }) {
  const { group } = await params;
  if (!['stainless', 'packaging'].includes(group)) return {};
  return { title: productionCopy.ru[group], description: productionCopy.ru[`${group}Intro`], alternates: { canonical: `/production/${group}` } };
}
export default async function Page({ params }) {
  const { group } = await params;
  if (!['stainless', 'packaging'].includes(group)) notFound();
  return <ProductionPage group={group}/>;
}

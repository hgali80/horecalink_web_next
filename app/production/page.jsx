import ProductionAreas from '../components/production/ProductionAreas';

export const metadata = {
  title: 'Наше производство',
  description: 'Производство оборудования из нержавеющей стали, пластиковой упаковки и мусорных пакетов HorecaLink.',
  alternates: { canonical: '/production' },
};

export default function ProductionIndex() {
  return <main className="min-h-screen bg-[#f7f8fa]"><ProductionAreas standalone /></main>;
}

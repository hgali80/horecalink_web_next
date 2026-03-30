//app/components/RelatedProducts.jsx
import ProductCard from "./ProductCard";

export default function RelatedProducts({ products = [] }) {
  if (!products.length) return null;

  return (
    <section className="mt-24 border-t border-[#eceef0] pt-16">
      <h2 className="mb-12 text-2xl font-extrabold tracking-tight text-[#1d3246] md:text-3xl">
        Benzer Ürünler
      </h2>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {products.slice(0, 3).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
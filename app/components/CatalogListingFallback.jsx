export default function CatalogListingFallback() {
  return (
    <section className="bg-[#f7f8fa] pb-20 pt-10" aria-busy="true">
      <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 xl:px-8">
        <div className="mb-8 h-56 animate-pulse rounded-[32px] bg-white" />
        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="hidden h-[520px] animate-pulse rounded-[28px] bg-white lg:block" />
          <div className="grid grid-cols-2 gap-3 md:gap-8 xl:grid-cols-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-[320px] animate-pulse rounded-[22px] bg-white shadow-[0_20px_50px_rgba(29,50,70,0.06)] sm:h-[470px] sm:rounded-[28px]"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

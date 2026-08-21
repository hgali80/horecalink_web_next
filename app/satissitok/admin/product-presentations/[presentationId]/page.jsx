import ProductPresentationEditor from "../ProductPresentationEditor";

export default async function ProductPresentationPage({ params }) {
  const { presentationId } = await params;
  return <ProductPresentationEditor presentationId={presentationId} />;
}

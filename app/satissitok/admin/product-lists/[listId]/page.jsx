import ProductListEditor from "../ProductListEditor";

export default async function ProductListPage({ params }) {
  const { listId } = await params;
  return <ProductListEditor listId={listId} />;
}

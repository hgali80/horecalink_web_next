import OfferEditor from "../OfferEditor";

export default async function NewCommercialOfferPage({ searchParams }) {
  const params = await searchParams;
  const sourceRequestId =
    typeof params?.sourceRequestId === "string" ? params.sourceRequestId : null;

  return <OfferEditor sourceRequestId={sourceRequestId} />;
}

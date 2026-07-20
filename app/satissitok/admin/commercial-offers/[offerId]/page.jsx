import OfferEditor from "../OfferEditor";

export default async function CommercialOfferDetailPage({ params }) {
  const { offerId } = await params;
  return <OfferEditor offerId={offerId || null} />;
}

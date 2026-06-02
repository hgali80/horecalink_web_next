import OfferEditor from "../OfferEditor";

export default function CommercialOfferDetailPage({ params }) {
  return <OfferEditor offerId={params?.offerId || null} />;
}

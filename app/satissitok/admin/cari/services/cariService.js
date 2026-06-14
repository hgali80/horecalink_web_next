import { listErpCaris } from "@/app/satissitok/admin/erp/_services/erpCarisService";

export async function listCaris() {
  const rows = await listErpCaris();

  return rows.map((item) => ({
    id: item.id,
    firm: item.name || "",
    director: item.directorName || item.shortName || "",
    bin: item.bin || "",
    legalAddress: item.legalAddress || "",
    mobile: item.phone || "",
    email: item.email || "",
    active: item.isActive !== false,
    source: "erp_caris",
  }));
}

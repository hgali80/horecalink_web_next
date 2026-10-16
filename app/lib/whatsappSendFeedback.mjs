export function formatSendRejection(diagnostics) {
  const numeric = value => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
  const details = [];
  if (numeric(diagnostics?.code)) details.push(`Meta kodu: ${diagnostics.code}`);
  if (numeric(diagnostics?.subcode)) details.push(`alt kod: ${diagnostics.subcode}`);
  if (numeric(diagnostics?.httpStatus)) details.push(`HTTP ${diagnostics.httpStatus}`);
  return `WhatsApp gönderimi reddetti.${details.length ? ` (${details.join(', ')})` : ' Önceki kayıtta hata kodu saklanmamış.'}`;
}

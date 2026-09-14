'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LanguageContext';
import { createQuoteRequest } from '../../services/quoteService';
import { getProductionCopy, localized, packagingFamilies, stainlessFamilies } from '../../lib/production';

export default function ProductionRequestForm({ group, family }) {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const c = getProductionCopy(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const lock = useRef(false);
  const families = group === 'packaging' ? packagingFamilies : stainlessFamilies;
  const quantityHint = group === 'packaging' ? c.quantityHint : ({ tr: 'Örn. 3 adet', ru: 'Например, 3 шт.', kz: 'Мысалы, 3 дана', en: 'E.g. 3 pieces' }[lang]);
  const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal text-slate-900 outline-none focus:border-[#286452] focus:ring-2 focus:ring-[#286452]/15';
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (!fields.fullName.trim() || !fields.phone.trim() || !fields.family) { setError(c.required); return; }
    const selected = families.find(item => item.slug === fields.family);
    const technical = ['size', 'thickness', 'color', 'print', 'quantity', 'dimensions', 'material', 'note']
      .filter(key => typeof fields[key] === 'string' && fields[key].trim())
      .map(key => `${c[key]}: ${fields[key].trim()}`);
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const request = await createQuoteRequest({
        user,
        items: [],
        production: { group, family: selected?.slug || 'unsure', language: lang },
        form: { ...fields, note: [c.productionNote, c[group], `${c.family}: ${selected ? localized(selected.name, lang) : c.unsure}`, ...technical].join('\n') },
      });
      setResult({ ...request, registered: Boolean(user?.uid) });
    } catch { setError(c.error); }
    finally { setBusy(false); lock.current = false; }
  }
  return <section id="request" className="scroll-mt-40 rounded-3xl bg-[#1d3246] p-6 text-white sm:p-10 lg:p-12">
    <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
      <div><span className="text-xs font-semibold uppercase tracking-widest text-emerald-200">HORECALINK / {c.nav}</span><h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{c.formTitle}</h2><p className="mt-5 text-sm leading-7 text-slate-300">{c.formIntro}</p><p className="mt-8 text-sm text-slate-300">{c[group]}</p><a href="tel:+77004446911" className="mt-3 inline-block text-xl font-semibold hover:underline">+7 700 444 69 11</a></div>
      {result ? <div role="status" className="rounded-2xl bg-white p-8 text-[#1d3246]"><CheckCircle2 size={36} className="text-[#286452]"/><h3 className="mt-4 text-xl font-bold">{c.success}</h3><p className="mt-3 break-all text-sm">{result.quoteNo}</p><Link className="mt-6 inline-flex items-center gap-2 font-bold underline" href={result.registered ? `/teklifler/${result.id}` : `/teklifler/${result.id}?access=${encodeURIComponent(result.accessKey)}`}>{c.detail}<ArrowUpRight size={18}/></Link></div> : <form onSubmit={submit} className="rounded-2xl bg-[#f5f7f9] p-5 text-[#1d3246] sm:p-7">
        <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">{c.family} *<select name="family" defaultValue={family?.slug || ''} required className={inputClass}><option value="" disabled>{c.family}</option>{families.map(item => <option key={item.slug} value={item.slug}>{localized(item.name, lang)}</option>)}<option value="unsure">{c.unsure}</option></select></label>
          {(group === 'packaging' ? ['size', 'thickness', 'color'] : ['dimensions', 'material']).map(key => <label key={key} className="text-sm font-semibold">{c[key]}<input name={key} maxLength={150} placeholder={c.unsure} className={inputClass}/></label>)}
          {group === 'packaging' && <label className="text-sm font-semibold">{c.print}<select name="print" className={inputClass}><option>{c.unsure}</option><option>{c.noPrint}</option><option>{c.withPrint}</option></select></label>}
          <label className="text-sm font-semibold sm:col-span-2">{c.quantity}<input name="quantity" maxLength={150} placeholder={quantityHint} className={inputClass}/></label>
          <label className="text-sm font-semibold sm:col-span-2">{c.note}<textarea name="note" maxLength={2000} rows={3} className={inputClass}/></label>
          <label className="text-sm font-semibold">{t('quoteRequest.form.fullName')} *<input name="fullName" autoComplete="name" defaultValue={user?.fullName || ''} required maxLength={150} className={inputClass}/></label>
          <label className="text-sm font-semibold">{t('quoteRequest.form.phone')} *<input name="phone" type="tel" autoComplete="tel" defaultValue={user?.phone || ''} required maxLength={50} className={inputClass}/></label>
          <label className="text-sm font-semibold">{t('quoteRequest.form.companyName')}<input name="companyName" autoComplete="organization" defaultValue={user?.businessName || ''} maxLength={150} className={inputClass}/></label>
          <label className="text-sm font-semibold">{t('quoteRequest.form.email')}<input name="email" type="email" autoComplete="email" defaultValue={user?.email || ''} maxLength={180} className={inputClass}/></label>
          <label className="text-sm font-semibold sm:col-span-2">{t('quoteRequest.form.city')}<input name="city" autoComplete="address-level2" defaultValue={user?.city || ''} maxLength={120} className={inputClass}/></label>
          {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#286452] px-5 py-4 text-sm font-bold text-white hover:bg-[#1c4e3f] disabled:opacity-60 sm:col-span-2"><Send size={17}/>{busy ? c.sending : c.send}</button>
        </fieldset>
      </form>}
    </div>
  </section>;
}

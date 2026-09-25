"use client";

import { useEffect, useState } from "react";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "af", label: "Afrikaans" },
  { code: "xh", label: "isiXhosa" },
  { code: "zu", label: "isiZulu" },
] as const;

type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];
const STORAGE_KEY = "nexus-language";
const LANGUAGE_EVENT = "nexus-language-change";

const shared: Record<string, [string, string, string]> = {
  "Services": ["Dienste", "Iinkonzo", "Izinsizakalo"],
  "Work": ["Werk", "Umsebenzi", "Umsebenzi"],
  "Process": ["Proses", "Inkqubo", "Inqubo"],
  "Pricing": ["Pryse", "Amaxabiso", "Amanani"],
  "FAQ": ["Gereelde Vrae", "Imibuzo Eqhelekileyo", "Imibuzo Evamile"],
  "CONTACT": ["KONTAK", "QHAGAMSHELANA", "XHUMANA"],
  "Contact": ["Kontak", "Qhagamshelana", "Xhumana"],
  "LOGIN": ["MELD AAN", "NGENA", "NGENA"],
  "CLIENT PORTAL LOGIN 🔑": ["KLIËNTEPORTAAL AANMELDING 🔑", "NGENA KWIPORTAL YOMTHENGI 🔑", "NGENA KUPHOTHALI YEKHASIMENDE 🔑"],
  "YOUR CONTENT.": ["JOU INHOUD.", "UMXHOLO WAKHO.", "OKUQUKETHWE KWAKHO."],
  "BUILD YOUR NEXUS": ["BOU JOU NEXUS", "YAKHA INEXUS YAKHO", "YAKHA INEXUS YAKHO"],
  "EXPLORE OUR WORK": ["VERKEN ONS WERK", "JONGA UMSEBENZI WETHU", "BHEKA UMSEBENZI WETHU"],
  "THE NEXUS": ["DIE NEXUS", "INEXUS", "INEXUS"],
  "Everything": ["Alles", "Yonke into", "Konke"],
  "CAPABILITIES": ["VERMOËNS", "AMANDLA", "AMAKHONO"],
  "We handle": ["Ons hanteer", "Siyalawula", "Siyaphatha"],
  "POST-PRODUCTION": ["NAPRODUKSIE", "EMVA KOKUVELISA", "NGEMVA KOKUKHIQIZA"],
  "CONTENT SYSTEMS": ["INHOUDSTELSELS", "IINKQUBO ZOMXHOLO", "IZINHLELO ZOKUQUKETHWE"],
  "MANAGEMENT": ["BESTUUR", "ULAWULO", "UKUPHATHA"],
  "SELECTED WORK": ["GESELEKTEERDE WERK", "UMSEBENZI OKHETHIWEYO", "UMSEBENZI OKHETHIWE"],
  "THE PROCESS": ["DIE PROSES", "INKQUBO", "INQUBO"],
  "Your content": ["Jou inhoud", "Umxholo wakho", "Okuqukethwe kwakho"],
  "MONTHLY": ["MAANDELIKS", "NYANGA NGENYANGA", "NYANGA ZONKE"],
  "CUSTOM": ["PASGEMAAK", "YENZELWE WENA", "OKWENZELWE WENA"],
  "CREATOR": ["SKEPPER", "UMDALI", "UMDALI"],
  "GET STARTED": ["BEGIN", "QALISA", "QALA"],
  "MOST POPULAR": ["GEWILDSTE", "ETHANDWA KAKHULU", "OKUTHANDWA KAKHULU"],
  "GROWTH": ["GROEI", "UKUKHULA", "UKUKHULA"],
  "BUILD MY SYSTEM": ["BOU MY STELSEL", "YAKHA INKQUBO YAM", "YAKHA UHLELO LWAMI"],
  "START A PROJECT": ["BEGIN 'N PROJEK", "QALA IPROJEKTHI", "QALA IPHROJEKTHI"],
  "CURRENT STATUS": ["HUIDIGE STATUS", "IMEKO YANGOKU", "ISIMO SAMANJE"],
  "PROJECT INTAKE": ["PROJEKINNAME", "UKUNGENISWA KWEPROJEKTHI", "UKUNGENISWA KWEPHROJEKTHI"],
  "NAME": ["NAAM", "IGAMA", "IGAMA"],
  "EMAIL": ["E-POS", "I-IMEYILE", "I-IMEYILI"],
  "CREATOR / COMPANY": ["SKEPPER / MAATSKAPPY", "UMDALI / INKAMPANI", "UMDALI / INKAMPANI"],
  "WHAT DO YOU NEED?": ["WAT HET JY NODIG?", "UFUNA NTONI?", "UDINGANI?"],
  "Select a service": ["Kies 'n diens", "Khetha inkonzo", "Khetha insizakalo"],
  "Post-production": ["Naproduksie", "Emva kokuvelisa", "Ngemva kokukhiqiza"],
  "Short-form content": ["Kortformaat-inhoud", "Umxholo omfutshane", "Okuqukethwe okufushane"],
  "Content management": ["Inhoudsbestuur", "Ulawulo lomxholo", "Ukuphathwa kokuqukethwe"],
  "Full content system": ["Volledige inhoudstelsel", "Inkqubo epheleleyo yomxholo", "Uhlelo oluphelele lokuqukethwe"],
  "Something custom": ["Iets pasgemaak", "Into eyenzelwe wena", "Into eyenzelwe wena"],
  "SEND PROJECT BRIEF ↗": ["STUUR PROJEKOPDRAG ↗", "THUMELA ISISHWANKATHELO SEPROJEKTHI ↗", "THUMELA ISIFINYEZO SEPHROJEKTHI ↗"],
  "SYSTEM ACCESS": ["STELSELTOEGANG", "UKUFIKELELA KWINKQUBO", "UKUFINYELELA OHLELWENI"],
  "LOG IN": ["MELD AAN", "NGENA", "NGENA"],
  "CREATE ACCOUNT": ["SKEP REKENING", "YENZA IAKHAWUNTI", "DALA I-AKHAWUNTI"],
  "OR VIA EMAIL": ["OF VIA E-POS", "OKANYE NGE-IMEYILE", "NOMA NGE-IMEYILI"],
  "EMAIL ADDRESS": ["E-POSADRES", "IDILESI YE-IMEYILE", "IKHELI LE-IMEYILI"],
  "PASSWORD": ["WAGWOORD", "IPHASIWEDI", "IPHASIWEDI"],
  "FORGOT?": ["VERGEET?", "ULIBALE?", "UKHOHLWE?"],
  "REMEMBER SESSION": ["ONTHOU SESSIE", "KHUMBULA ISESHONI", "KHUMBULA ISESHINI"],
  "FULL NAME / BRAND": ["VOLLE NAAM / HANDELSMERK", "IGAMA ELIPHELELEYO / IBRAND", "IGAMA ELIGCWELE / IBRAND"],
  "WORK EMAIL": ["WERK-E-POS", "I-IMEYILE YOMSEBENZI", "I-IMEYILI YOMSEBENZI"],
  "ACCOUNT TYPE": ["REKENINGTIPE", "UHLOBO LWEAKHAWUNTI", "UHLOBO LWE-AKHAWUNTI"],
  "EDITOR": ["REDIGEERDER", "UMHLELI", "UMHLELI"],
  "CREATE PASSWORD": ["SKEP WAGWOORD", "YENZA IPHASIWEDI", "DALA IPHASIWEDI"],
  "NAVIGATION": ["NAVIGASIE", "UKUHAMBA", "UKUZULAZULA"],
  "WORKSPACE": ["WERKRUIMTE", "INDAWO YOMSEBENZI", "INDAWO YOMSEBENZI"],
  "ACTIVE SESSION": ["AKTIEWE SESSIE", "ISESHONI ESEBENZAYO", "ISESHINI ESEBENZAYO"],
  "ORGANIZATION": ["ORGANISASIE", "UMBUTHO", "INHLANGANO"],
  "LOADING...": ["LAAI...", "IYALAYISHA...", "IYALAYISHA..."],
  "NOTIFICATIONS": ["KENNISGEWINGS", "IZAZISO", "IZAZISO"],
  "No notifications yet.": ["Nog geen kennisgewings nie.", "Akukho zaziso okwangoku.", "Azikho izaziso okwamanje."],
  "+ NEW PROJECT BRIEF": ["+ NUWE PROJEKOPDRAG", "+ ISISHWANKATHELO ESITSHA SEPROJEKTHI", "+ ISIFINYEZO ESISHA SEPHROJEKTHI"],
  "ACTIVE EDITS": ["AKTIEWE REDIGERINGS", "UHLELO OLUSEBENZAYO", "UKUHLELA OKUSEBENZAYO"],
  "DELIVERED": ["AFGELEWER", "IHANJISIWE", "KULETHIWE"],
  "ASSETS": ["BATES", "II-ASETHI", "AMA-ASETHI"],
  "IN REVIEW": ["IN HERSIENING", "KUPHONONONGO", "KUBUYEKEZWA"],
  "ACTIVE PRODUCTION QUEUE": ["AKTIEWE PRODUKSIEWAGLYS", "UMGCA WEMVELISO OSEBENZAYO", "UMUGQA WOKUKHIQIZA OSEBENZAYO"],
  "VIEW ALL →": ["SIEN ALLES →", "BONA ZONKE →", "BONA KONKE →"],
  "SYSTEM ACTIVITY": ["STELSELAKTIWITEIT", "UMSEBENZI WENKQUBO", "UMSEBENZI WOHLELO"],
  "NO ACTIVITY YET": ["NOG GEEN AKTIWITEIT NIE", "AKUKHO MSEBENZI OKWANGOKU", "AWUKHO UMSEBENZI OKWAMANJE"],
  "ALL CREATOR PROJECTS": ["ALLE SKEPPERPROJEKTE", "ZONKE IIPROJEKTHI ZABADALI", "WONKE AMAPHROJEKTHI ABADALI"],
  "TITLE & FORMAT": ["TITEL & FORMAAT", "ISIHLOKO & IFOMATHI", "ISIHLOKO & IFOMETHI"],
  "TYPE": ["TIPE", "UHLOBO", "UHLOBO"],
  "STATUS": ["STATUS", "IMEKO", "ISIMO"],
  "ETA / VERSION": ["ETA / WEERGAWE", "ETA / UGUQULELO", "ETA / INGUQULO"],
  "ACTION": ["AKSIE", "ISENZO", "ISENZO"],
  "ALL CREATORS": ["ALLE SKEPPERS", "BONKE ABADALI", "BONKE ABADALI"],
  "ACTIVE": ["AKTIEF", "IYASEBENZA", "IYASEBENZA"],
  "OPEN WORKSPACE ↗": ["OPEN WERKRUIMTE ↗", "VULA INDAWO YOMSEBENZI ↗", "VULA INDAWO YOMSEBENZI ↗"],
  "CREATOR WORKSPACE": ["SKEPPERWERKRUIMTE", "INDAWO YOMDALI", "INDAWO YOMDALI"],
  "ACTIVE PROJECTS": ["AKTIEWE PROJEKTE", "IIPROJEKTHI EZISEBENZAYO", "AMAPHROJEKTHI ASEBENZAYO"],
  "CREATOR ACCESS": ["SKEPPERTOEGANG", "UKUFIKELELA KOMDALI", "UKUFINYELELA KOMDALI"],
  "AVAILABLE EDITORS": ["BESKIKBARE REDIGEERDERS", "ABAHLELI ABAFUMANEKAYO", "ABAHLELI ABATHOLAKALAYO"],
  "PROJECT DETAILS": ["PROJEKBESONDERHEDE", "IINKCUKACHA ZEPROJEKTHI", "IMINININGWANE YEPHROJEKTHI"],
  "CONTENT TYPE": ["INHOUDTIPE", "UHLOBO LOMXHOLO", "UHLOBO LOKUQUKETHWE"],
  "SUBMITTED": ["INGEDIEN", "INGENISIWE", "KUTHUNYELWE"],
  "PRODUCTION TASKS": ["PRODUKSIETAKE", "IMISEBENZI YEMVELISO", "IMISEBENZI YOKUKHIQIZA"],
  "PROJECT TASKS": ["PROJEKTAKE", "IMISEBENZI YEPROJEKTHI", "IMISEBENZI YEPHROJEKTHI"],
  "CREATE TASK": ["SKEP TAAK", "YENZA UMSEBENZI", "DALA UMSEBENZI"],
  "TASK TITLE": ["TAAKTITEL", "ISIHLOKO SOMSEBENZI", "ISIHLOKO SOMSEBENZI"],
  "PRIORITY": ["PRIORITEIT", "OKUPHAMBILI", "OKUBALULEKILE"],
  "ASSIGNED EDITOR": ["TOEGEWESE REDIGEERDER", "UMHLELI OWABELWEYO", "UMHLELI OWABELWE"],
  "UNASSIGNED": ["ONTOEGEWYS", "AKWABELWANGA", "AKWABELWANGA"],
  "DUE DATE": ["SPERDATUM", "UMHLA WOKUGQIBELA", "USUKU LOKUPHELA"],
  "DESCRIPTION": ["BESKRYWING", "INKCAZELO", "INCAZELO"],
  "COMPLETED": ["VOLTOOI", "IGQITYIWE", "KUPHELILE"],
  "PROJECT ACCESS": ["PROJEKTOEGANG", "UKUFIKELELA KWIPROJEKTHI", "UKUFINYELELA KWEPHROJEKTHI"],
  "ASSIGNED EDITORS": ["TOEGEWESE REDIGEERDERS", "ABAHLELI ABABELWEYO", "ABAHLELI ABABELWE"],
  "PRODUCTION WORKFLOW": ["PRODUKSIEWERKVLOEI", "INKQUBO YEMVELISO", "INDLELA YOKUKHIQIZA"],
  "CURRENT": ["HUIDIG", "YANGOKU", "YAMANJE"],
  "PRODUCTION": ["PRODUKSIE", "IMVELISO", "UKUKHIQIZA"],
  "NEXT ACTION": ["VOLGENDE AKSIE", "ISENZO ESILANDELAYO", "ISENZO ESILANDELAYO"],
  "PROJECT REVIEW": ["PROJEKHERSIENING", "UPHONONONGO LWEPROJEKTHI", "UKUBUYEKEZWA KWEPHROJEKTHI"],
  "REVIEW & APPROVAL": ["HERSIENING & GOEDKEURING", "UPHONONONGO & UKUVUMA", "UKUBUYEKEZA & UKUGUNYAZA"],
  "REVIEW COMMENT": ["HERSIENINGSKOMMENTAAR", "IZIMVO ZOPHONONONGO", "AMAZWANA OKUBUYEKEZA"],
  "DECISION NOTES": ["BESLUITNOTAS", "AMANQAKU ESIGQIBO", "AMANOTHI ESINQUMO"],
  "CREATOR ASSET VAULT": ["SKEPPER-BATEKLUIS", "IVAWUTI YEE-ASETHI ZOMDALI", "IVAWUTI YAMA-ASETHI YOMDALI"],
  "PRIVATE STORAGE": ["PRIVAAT BERGING", "UGCINO LWABUCALA", "ISITOREJI ESIYIMFIHLO"],
  "UPLOAD NEW ASSET": ["LAAI NUWE BATE OP", "LAYISHA I-ASETHI ENTSHA", "LAYISHA I-ASETHI ENTSHA"],
  "PROJECT": ["PROJEK", "IPROJEKTHI", "IPHROJEKTHI"],
  "FILE": ["LÊER", "IFAYILE", "IFAYELA"],
  "IMAGE": ["BEELD", "UMFANEKISO", "ISITHOMBE"],
  "AUDIO": ["KLANK", "IAUDIO", "UMSINDO"],
  "DOCUMENT": ["DOKUMENT", "UXWEBHU", "IDOKHUMENTI"],
  "OTHER": ["ANDER", "ENYE", "OKUNYE"],
  "ANALYTICS": ["ONTLEDING", "UHLAHLELO", "IZIBALO"],
  "PERFORMANCE ANALYTICS": ["PRESTASIE-ONTLEDING", "UHLAHLELO LOKUSEBENZA", "IZIBALO ZOKUSEBENZA"],
  "ACCOUNT CONTROL": ["REKENINGBEHEER", "ULAWULO LWEAKHAWUNTI", "UKULAWULWA KWE-AKHAWUNTI"],
  "ACCOUNT & WORKSPACE": ["REKENING & WERKRUIMTE", "IAKHAWUNTI & INDAWO YOMSEBENZI", "I-AKHAWUNTI & INDAWO YOMSEBENZI"],
  "PROFILE": ["PROFIEL", "IPROFAYILE", "IPHROFAYELA"],
  "ACCOUNT NAME": ["REKENINGNAAM", "IGAMA LEAKHAWUNTI", "IGAMA LE-AKHAWUNTI"],
  "PRIMARY EMAIL": ["PRIMÊRE E-POS", "I-IMEYILE EPHAMBILI", "I-IMEYILI EYINHLOKO"],
  "WORKSPACE ROLE": ["WERKRUIMTEROL", "INDIMA YENDAWO YOMSEBENZI", "INDIMA YENDAWO YOMSEBENZI"],
  "SECURITY": ["SEKURITEIT", "UKHUSELEKO", "UKUPHEPHA"],
  "CURRENT PASSWORD": ["HUIDIGE WAGWOORD", "IPHASIWEDI YANGOKU", "IPHASIWEDI YAMANJE"],
  "NEW PASSWORD": ["NUWE WAGWOORD", "IPHASIWEDI ENTSHA", "IPHASIWEDI ENTSHA"],
  "CONFIRM NEW PASSWORD": ["BEVESTIG NUWE WAGWOORD", "QINISEKISA IPHASIWEDI ENTSHA", "QINISEKISA IPHASIWEDI ENTSHA"],
  "APPEARANCE & SESSION": ["VOORKOMS & SESSIE", "INKANGELEKO & ISESHONI", "UKUBUKEKA & ISESHINI"],
  "DARK": ["DONKER", "MNYAMA", "MNYAMA"],
  "LIGHT": ["LIG", "KHANYA", "KHANYA"],
  "SIGN OUT ↗": ["MELD AF ↗", "PHUMA ↗", "PHUMA ↗"],
  "SUBMIT NEW PROJECT BRIEF": ["DIEN NUWE PROJEKOPDRAG IN", "NGENISA ISISHWANKATHELO ESITSHA SEPROJEKTHI", "THUMELA ISIFINYEZO ESISHA SEPHROJEKTHI"],
  "PROJECT TITLE": ["PROJEKTITEL", "ISIHLOKO SEPROJEKTHI", "ISIHLOKO SEPHROJEKTHI"],
  "QUEUED": ["IN WAGLYS", "EMGCENI", "EMGQENI"],
  "IN PRODUCTION": ["IN PRODUKSIE", "KWIMVELISO", "IYAKHIQIZWA"],
  "NEEDS REVIEW": ["BENODIG HERSIENING", "IFUNA UPHONONONGO", "IDINGA UKUBUYEKEZWA"],
  "REVISION REQUESTED": ["HERSIENING VERSOEK", "UHLAZIYO LUCELIWE", "KUCELWE UKUBUYEKEZWA"],
  "APPROVED": ["GOEDGEKEUR", "IVUNYIWE", "KUGUNYAZIWE"],
  "SCHEDULED": ["GESKEDULEER", "ICWANGCISIWE", "KUHLELIWE"],
  "LOW": ["LAAG", "PHANTSI", "PHANSI"],
  "MEDIUM": ["MEDIUM", "PHAKATHI", "PHAKATHI"],
  "HIGH": ["HOOG", "PHEZULU", "PHEZULU"],
  "URGENT": ["DRINGEND", "NGOKUNGXAMISEKILEYO", "KUPHUTHUMA"],
  "TO DO": ["OM TE DOEN", "MAKWENZIWE", "OKUZOKWENZIWA"],
  "IN PROGRESS": ["AAN DIE GANG", "IYAQHUBA", "KUYAQHUBEKA"],
  "CREATOR PERFORMANCE": ["SKEPPERPRESTASIE", "UKUSEBENZA KOMDALI", "UKUSEBENZA KOMDALI"],
  "SOON": ["BINNEKORT", "KUNGEKUDALA", "MADUZE"],
  "YOUTUBE ANALYTICS": ["YOUTUBE-ONTLEDING", "UHLAHLELO LWEYOUTUBE", "IZIBALO ZE-YOUTUBE"],
  "CONNECT YOUR YOUTUBE CHANNEL": ["KOPPEL JOU YOUTUBE-KANAAL", "QHAGAMSHELA ITSHANELI YAKHO YEYOUTUBE", "XHUMANISA ISITESHI SAKHO SE-YOUTUBE"],
  "NOT CONNECTED": ["NIE GEKOPPEL NIE", "AKUQHAGAMSHELWANGA", "AKUXHUNYIWE"],
  "CONNECT YOUTUBE": ["KOPPEL YOUTUBE", "QHAGAMSHELA IYOUTUBE", "XHUMANISA I-YOUTUBE"],
  "TOTAL VIEWS": ["TOTALE KYKE", "UKUBUKELWA KONKE", "UKUBUKWA KONKE"],
  "WATCH TIME": ["KYKTYD", "IXESHA LOKUBUKELA", "ISIKHATHI SOKUBUKA"],
  "SUBSCRIBERS": ["INTEKENAARS", "ABABHALISILEYO", "ABABHALISILE"],
  "IMPRESSIONS CTR": ["VERTONINGS-CTR", "I-CTR YOKUBONAKALA", "I-CTR YOKUBONISWA"],
  "CHANNEL TREND": ["KANAALTENDENS", "INDLELA YETSHANELI", "UMKHUBA WESITESHI"],
  "PERFORMANCE OVER TIME": ["PRESTASIE OOR TYD", "UKUSEBENZA NGOKUHAMBELA KWEXESHA", "UKUSEBENZA NGOKUHAMBA KWESIKHATHI"],
  "LAST 28 DAYS": ["LAASTE 28 DAE", "IINTSUKU EZINGAMA-28 EZIDLULILEYO", "IZINSUKU EZINGAMA-28 EZEDLULE"],
  "CHANNEL DATA WILL APPEAR HERE": ["KANAALDATA SAL HIER VERSKYN", "IDATHA YETSHANELI IZA KUBONAKALA APHA", "IDATHA YESITESHI IZOVELA LAPHA"],
  "CONTENT": ["INHOUD", "UMXHOLO", "OKUQUKETHWE"],
  "TOP VIDEOS": ["TOPVIDEO'S", "IIVIDIYO EZIPHAMBILI", "AMAVIDIYO APHEZULU"],
  "VIDEO PERFORMANCE": ["VIDEOPRESTASIE", "UKUSEBENZA KWEVIDIYO", "UKUSEBENZA KWEVIDIYO"],
  "Waiting for YouTube data": ["Wag vir YouTube-data", "Kulindelwe idatha yeYouTube", "Kulindelwe idatha yeYouTube"],
  "INTEGRATION ROADMAP": ["INTEGRASIEPADKAART", "ISICWANGCISO SODIBANISO", "UHLELO LOKUHLANGANISA"],
  "PLATFORM CONNECTIONS": ["PLATFORMKOPPELINGS", "UQHAGAMSHELWANO LWAMAQONGA", "UKUXHUMANA KWAMAPULATIFOMU"],
  "NEXT TO CONNECT": ["VOLGENDE OM TE KOPPEL", "ELANDELAYO UKUQHAGAMSHELA", "OKULANDELAYO UKUXHUMANISA"],
  "PLANNED": ["BEPLAN", "ICWANGCISIWE", "KUHLELIWE"],

};

const localeIndex: Record<Exclude<LanguageCode, "en">, number> = { af: 0, xh: 1, zu: 2 };
const attrs = ["placeholder", "title", "aria-label"] as const;
const originalText = new WeakMap<Text, string>();
const originalAttrs = new WeakMap<Element, Map<string, string>>();

function normalize(value?: string | null): LanguageCode {
  const code = String(value || "").toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.some((item) => item.code === code) ? (code as LanguageCode) : "en";
}

function detect(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return normalize(saved);
  for (const value of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const code = String(value || "").toLowerCase().split("-")[0];
    if (SUPPORTED_LANGUAGES.some((item) => item.code === code)) return normalize(code);
  }
  return "en";
}

function translate(value: string, language: LanguageCode) {
  if (language === "en") return value;
  const row = shared[value];
  return row ? row[localeIndex[language]] : value;
}

function ignored(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return Boolean(element?.closest('[data-i18n-ignore="true"],script,style,code,pre,[contenteditable="true"]'));
}

function applyText(node: Text, language: LanguageCode) {
  if (ignored(node)) return;
  if (!originalText.has(node)) originalText.set(node, node.nodeValue || "");
  const source = originalText.get(node) || "";
  const core = source.trim();
  if (!core) return;
  const leading = source.match(/^\s*/)?.[0] || "";
  const trailing = source.match(/\s*$/)?.[0] || "";
  node.nodeValue = `${leading}${translate(core, language)}${trailing}`;
}

function applyAttrs(element: Element, language: LanguageCode) {
  if (ignored(element)) return;
  let stored = originalAttrs.get(element);
  if (!stored) {
    stored = new Map();
    originalAttrs.set(element, stored);
  }
  attrs.forEach((attr) => {
    if (!element.hasAttribute(attr)) return;
    if (!stored!.has(attr)) stored!.set(attr, element.getAttribute(attr) || "");

    const translated = translate(stored!.get(attr) || "", language);

    // Avoid repeatedly writing the same attribute value.
    // Because the MutationObserver watches attributes, rewriting an
    // unchanged value can cause a self-triggering loop and freeze the page.
    if (element.getAttribute(attr) !== translated) {
      element.setAttribute(attr, translated);
    }
  });
}

function applyTree(root: Node, language: LanguageCode) {
  if (root.nodeType === Node.TEXT_NODE) return applyText(root as Text, language);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) applyAttrs(root as Element, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) applyText(node as Text, language);
    else applyAttrs(node as Element, language);
    node = walker.nextNode();
  }
}

export function InterfaceTranslator() {
  const [language, setLanguage] = useState<LanguageCode>("en");
  useEffect(() => setLanguage(detect()), []);
  useEffect(() => {
    document.documentElement.lang = language;
    applyTree(document.body, language);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => applyTree(node, language));
        if (mutation.type === "attributes") applyAttrs(mutation.target as Element, language);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [...attrs] });
    return () => observer.disconnect();
  }, [language]);
  useEffect(() => {
    const handler = (event: Event) => setLanguage(normalize((event as CustomEvent<string>).detail));
    window.addEventListener(LANGUAGE_EVENT, handler);
    return () => window.removeEventListener(LANGUAGE_EVENT, handler);
  }, []);
  return null;
}

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const [language, setLanguage] = useState<LanguageCode>("en");
  useEffect(() => {
    setLanguage(detect());
    const handler = (event: Event) => setLanguage(normalize((event as CustomEvent<string>).detail));
    window.addEventListener(LANGUAGE_EVENT, handler);
    return () => window.removeEventListener(LANGUAGE_EVENT, handler);
  }, []);

  const changeLanguage = (value: string) => {
    const next = normalize(value);
    localStorage.setItem(STORAGE_KEY, next);
    setLanguage(next);
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: next }));
  };

  return (
    <label className={`language-selector ${compact ? "language-selector-compact" : ""}`} data-i18n-ignore="true">
      <span className="language-selector-label">LANG</span>
      <select aria-label="Language" value={language} onChange={(event) => changeLanguage(event.target.value)}>
        {SUPPORTED_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
      </select>
    </label>
  );
}

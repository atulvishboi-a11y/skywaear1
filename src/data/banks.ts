/**
 * Indian bank master for payout details.
 *
 * Curated from RBI's list of scheduled commercial banks (public, private, small
 * finance, payments, regional rural and local area banks operating in India).
 * Kept as data (not UI code) so names and aliases can be searched and resolved
 * across the site without touching components.
 */
export type IndianBankStatus = "ACTIVE" | "RESTRICTED" | "MERGED";

export type IndianBankCategory =
  | "PUBLIC"
  | "PRIVATE"
  | "SMALL_FINANCE"
  | "PAYMENTS"
  | "REGIONAL_RURAL"
  | "LOCAL_AREA"
  | "COOPERATIVE"
  | "FOREIGN";

export interface IndianBank {
  /** Canonical name shown after selection and stored on the payout profile. */
  name: string;
  /** Common abbreviation or brand used by customers. */
  shortName: string;
  /** Search aliases (former names, spacing variants, popular shorthand). */
  aliases: string[];
  status: IndianBankStatus;
  category?: IndianBankCategory;
  /** Tie-breaker so the most-used bank wins a shared prefix search. */
  rank?: number;
}

export const INDIAN_BANKS: readonly IndianBank[] = [
  // =================================================================
  // [PUBLIC SECTOR BANKS]
  // =================================================================
  { name: "State Bank of India", shortName: "SBI", aliases: ["State Bank", "SBI Bank", "State Bank of Bikaner and Jaipur"], status: "ACTIVE", category: "PUBLIC", rank: 1 },
  { name: "Bank of Baroda", shortName: "BOB", aliases: ["Baroda Bank", "BOB Bank", "Dena Bank", "Vijaya Bank"], status: "ACTIVE", category: "PUBLIC", rank: 2 },
  { name: "Bank of India", shortName: "BOI", aliases: ["Bank of India", "BOI Bank"], status: "ACTIVE", category: "PUBLIC", rank: 3 },
  { name: "Bank of Maharashtra", shortName: "BOM", aliases: ["Maharashtra Bank", "BOM Bank"], status: "ACTIVE", category: "PUBLIC", rank: 4 },
  { name: "Canara Bank", shortName: "CNRB", aliases: ["Canara", "Canara Bank", "Syndicate Bank"], status: "ACTIVE", category: "PUBLIC", rank: 5 },
  { name: "Central Bank of India", shortName: "CBI", aliases: ["Central Bank", "CBI Bank"], status: "ACTIVE", category: "PUBLIC", rank: 6 },
  { name: "Indian Bank", shortName: "IB", aliases: ["Indian Bank", "Allahabad Bank"], status: "ACTIVE", category: "PUBLIC", rank: 7 },
  { name: "Indian Overseas Bank", shortName: "IOB", aliases: ["Indian Overseas", "IOB Bank"], status: "ACTIVE", category: "PUBLIC", rank: 8 },
  { name: "Punjab & Sind Bank", shortName: "PSB", aliases: ["Punjab and Sind Bank", "Punjab Sind Bank", "PSB"], status: "ACTIVE", category: "PUBLIC", rank: 9 },
  { name: "Punjab National Bank", shortName: "PNB", aliases: ["Punjab National", "PNB Bank", "Oriental Bank of Commerce", "United Bank of India"], status: "ACTIVE", category: "PUBLIC", rank: 10 },
  { name: "UCO Bank", shortName: "UCO", aliases: ["UCO", "United Commercial Bank"], status: "ACTIVE", category: "PUBLIC", rank: 11 },
  { name: "Union Bank of India", shortName: "UBI", aliases: ["Union Bank", "Andhra Bank", "Corporation Bank"], status: "ACTIVE", category: "PUBLIC", rank: 12 },

  // =================================================================
  // [PRIVATE SECTOR BANKS]
  // =================================================================
  { name: "Axis Bank", shortName: "AXIS", aliases: ["Axis", "UTI Bank"], status: "ACTIVE", category: "PRIVATE", rank: 13 },
  { name: "Bandhan Bank", shortName: "BANDHAN", aliases: ["Bandhan"], status: "ACTIVE", category: "PRIVATE" },
  { name: "CSB Bank", shortName: "CSB", aliases: ["Catholic Syrian Bank", "CSB"], status: "ACTIVE", category: "PRIVATE" },
  { name: "City Union Bank", shortName: "CUB", aliases: ["City Union", "CUB"], status: "ACTIVE", category: "PRIVATE" },
  { name: "DCB Bank", shortName: "DCB", aliases: ["Development Credit Bank", "DCB"], status: "ACTIVE", category: "PRIVATE" },
  { name: "Dhanlaxmi Bank", shortName: "DHAN", aliases: ["Dhanlaxmi", "Dhanalakshmi Bank", "DHAN"], status: "ACTIVE", category: "PRIVATE" },
  { name: "Federal Bank", shortName: "FEDERAL", aliases: ["Federal", "Federal Bank Ltd"], status: "ACTIVE", category: "PRIVATE" },
  { name: "HDFC Bank", shortName: "HDFC", aliases: ["HDFC", "HDFC Bank Ltd"], status: "ACTIVE", category: "PRIVATE", rank: 14 },
  { name: "ICICI Bank", shortName: "ICICI", aliases: ["ICICI", "ICICI Bank Ltd"], status: "ACTIVE", category: "PRIVATE", rank: 15 },
  { name: "IndusInd Bank", shortName: "INDUSIND", aliases: ["IndusInd", "IndusInd Bank Ltd"], status: "ACTIVE", category: "PRIVATE" },
  { name: "IDFC FIRST Bank", shortName: "IDFC", aliases: ["IDFC First", "IDFC Bank", "IDFC FIRST Bank"], status: "ACTIVE", category: "PRIVATE" },
  { name: "Jammu & Kashmir Bank", shortName: "JKB", aliases: ["J&K Bank", "Jammu Kashmir Bank", "JKB"], status: "ACTIVE", category: "PRIVATE" },
  { name: "Karnataka Bank", shortName: "KBL", aliases: ["Karnataka Bank", "KBL"], status: "ACTIVE", category: "PRIVATE" },
  { name: "Karur Vysya Bank", shortName: "KVB", aliases: ["Karur Vysya", "KVB"], status: "ACTIVE", category: "PRIVATE" },
  { name: "Kotak Mahindra Bank", shortName: "KOTAK", aliases: ["Kotak", "Kotak Bank", "Kotak Mahindra"], status: "ACTIVE", category: "PRIVATE", rank: 16 },
  { name: "Nainital Bank", shortName: "NAINITAL", aliases: ["Nainital", "NTBL"], status: "ACTIVE", category: "PRIVATE" },
  { name: "RBL Bank", shortName: "RBL", aliases: ["Ratnakar Bank", "RBL"], status: "ACTIVE", category: "PRIVATE" },
  { name: "South Indian Bank", shortName: "SIB", aliases: ["South Indian", "SIB"], status: "ACTIVE", category: "PRIVATE" },
  { name: "Tamilnad Mercantile Bank", shortName: "TMB", aliases: ["Tamilnad Mercantile", "Tamil Nadu Mercantile Bank", "TMB"], status: "ACTIVE", category: "PRIVATE" },
  { name: "YES Bank", shortName: "YES", aliases: ["Yes", "Yes Bank Ltd"], status: "ACTIVE", category: "PRIVATE" },
  { name: "IDBI Bank", shortName: "IDBI", aliases: ["IDBI", "Industrial Development Bank of India"], status: "ACTIVE", category: "PRIVATE" },

  // =================================================================
  // [SMALL FINANCE BANKS]
  // =================================================================
  { name: "AU Small Finance Bank", shortName: "AU", aliases: ["AU Bank", "AU SFB", "Fincare Small Finance Bank"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "Capital Small Finance Bank", shortName: "CAPITAL", aliases: ["Capital SFB", "Capital Local Area Bank"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "Equitas Small Finance Bank", shortName: "EQUITAS", aliases: ["Equitas", "Equitas SFB"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "ESAF Small Finance Bank", shortName: "ESAF", aliases: ["ESAF", "ESAF SFB"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "Suryoday Small Finance Bank", shortName: "SURYODAY", aliases: ["Suryoday", "Suryoday SFB"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "Ujjivan Small Finance Bank", shortName: "UJJIVAN", aliases: ["Ujjivan", "Ujjivan SFB"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "Utkarsh Small Finance Bank", shortName: "UTKARSH", aliases: ["Utkarsh", "Utkarsh SFB"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "Slice Small Finance Bank", shortName: "SLICE", aliases: ["Slice", "North East Small Finance Bank", "NESFB", "Slice SFB", "Slice Bank"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "Jana Small Finance Bank", shortName: "JANA", aliases: ["Jana", "Jana SFB"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "Shivalik Small Finance Bank", shortName: "SHIVALIK", aliases: ["Shivalik", "Shivalik SFB"], status: "ACTIVE", category: "SMALL_FINANCE" },
  { name: "Unity Small Finance Bank", shortName: "UNITY", aliases: ["Unity SFB", "PMC Bank"], status: "ACTIVE", category: "SMALL_FINANCE" },

  // =================================================================
  // [PAYMENTS BANKS]
  // =================================================================
  { name: "Airtel Payments Bank", shortName: "AIRTEL", aliases: ["Airtel Bank", "Airtel Money"], status: "ACTIVE", category: "PAYMENTS" },
  { name: "India Post Payments Bank", shortName: "IPPB", aliases: ["India Post Bank", "Post Payments Bank", "IPPB"], status: "ACTIVE", category: "PAYMENTS" },
  { name: "Fino Payments Bank", shortName: "FINO", aliases: ["Fino Bank", "Fino Paytech"], status: "ACTIVE", category: "PAYMENTS" },
  { name: "Paytm Payments Bank", shortName: "PAYTM", aliases: ["Paytm Bank", "Paytm"], status: "ACTIVE", category: "PAYMENTS" },
  { name: "Jio Payments Bank", shortName: "JIO", aliases: ["Jio Bank", "Reliance Jio"], status: "ACTIVE", category: "PAYMENTS" },
  { name: "NSDL Payments Bank", shortName: "NSDL", aliases: ["NSDL Bank"], status: "ACTIVE", category: "PAYMENTS" },

  // =================================================================
  // [REGIONAL RURAL BANKS]
  // =================================================================
  { name: "Andhra Pradesh Grameena Bank", shortName: "APGB", aliases: ["Andhra Pragathi Grameena Bank", "AP Grameena Vikas Bank", "APGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Assam Gramin Bank", shortName: "AGVB", aliases: ["Assam Gramin Vikash Bank", "AGVB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Arunachal Pradesh Rural Bank", shortName: "APRB", aliases: ["Arunachal Pradesh Rural", "APRB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Bihar Gramin Bank", shortName: "BGB", aliases: ["Dakshin Bihar Gramin Bank", "Uttar Bihar Gramin Bank", "BGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Chhattisgarh Gramin Bank", shortName: "CGB", aliases: ["Chhattisgarh Rajya Gramin Bank", "CRGB", "CGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Gujarat Gramin Bank", shortName: "GGB", aliases: ["Baroda Gujarat Gramin Bank", "Saurashtra Gramin Bank", "GGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Haryana Gramin Bank", shortName: "HGB", aliases: ["Sarva Haryana Gramin Bank", "HGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Himachal Pradesh Gramin Bank", shortName: "HPGB", aliases: ["HP Gramin Bank", "HPGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Jharkhand Gramin Bank", shortName: "JRGB", aliases: ["Jharkhand Rajya Gramin Bank", "JRGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Jammu and Kashmir Grameen Bank", shortName: "JKGB", aliases: ["JK Grameen Bank", "JKGB", "Ellaquai Dehati Bank"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Karnataka Grameena Bank", shortName: "KAGB", aliases: ["Karnataka Gramin Bank", "Karnataka Vikas Grameena Bank", "KVGB", "KAGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Kerala Grameena Bank", shortName: "KRGB", aliases: ["Kerala Gramin Bank", "KGB", "KRGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Maharashtra Gramin Bank", shortName: "MGB", aliases: ["Maharashtra Gramin", "MGB", "Vidharbha Konkan Gramin Bank"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Madhya Pradesh Gramin Bank", shortName: "MPGB", aliases: ["MP Gramin Bank", "Madhya Bharat Gramin Bank", "MPGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Manipur Rural Bank", shortName: "MNRB", aliases: ["Manipur Rural", "MNRB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Mizoram Rural Bank", shortName: "MZRB", aliases: ["Mizoram Rural", "MZRB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Nagaland Rural Bank", shortName: "NGRB", aliases: ["Nagaland Rural", "NGRB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Odisha Grameen Bank", shortName: "OGB", aliases: ["Odisha Gramya Bank", "Utkal Grameen Bank", "OGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Punjab Gramin Bank", shortName: "PGB", aliases: ["Punjab Gramin", "PGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Puducherry Grama Bank", shortName: "PYGB", aliases: ["Puduvai Bharathiar Grama Bank", "PYGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Rajasthan Gramin Bank", shortName: "RGB", aliases: ["Rajasthan Marudhara Gramin Bank", "Baroda Rajasthan Kshetriya Gramin Bank", "RGB", "RMGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Tamil Nadu Grama Bank", shortName: "TNGB", aliases: ["Tamil Nadu Gramin Bank", "Pandyan Grama Bank", "TNGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Telangana Grameena Bank", shortName: "TGB", aliases: ["Telangana Grameena", "TGB", "Andhra Pradesh Grameena Vikas Bank"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Tripura Gramin Bank", shortName: "TRGB", aliases: ["Tripura Gramin", "TRGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Uttar Pradesh Gramin Bank", shortName: "UPGB", aliases: ["Baroda UP Bank", "Aryavart Bank", "Prathama UP Gramin Bank", "UPGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "Uttarakhand Gramin Bank", shortName: "UKGB", aliases: ["Uttarakhand Gramin", "UGB", "UKGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },
  { name: "West Bengal Gramin Bank", shortName: "WBGB", aliases: ["Bangiya Gramin Vikash Bank", "Paschim Banga Gramin Bank", "Uttarbanga Kshetriya Gramin Bank", "WBGB"], status: "ACTIVE", category: "REGIONAL_RURAL" },

  // =================================================================
  // [LOCAL AREA BANKS]
  // =================================================================
  { name: "Coastal Local Area Bank", shortName: "CLAB", aliases: ["Coastal Local Area Bank Ltd", "Coastal Bank", "CLAB"], status: "ACTIVE", category: "LOCAL_AREA" },
  { name: "Krishna Bhima Samruddhi Local Area Bank", shortName: "KBSLAB", aliases: ["KBS Local Area Bank", "KBS Bank", "Krishna Bhima Samruddhi", "KBSLAB"], status: "ACTIVE", category: "LOCAL_AREA" },

  // =================================================================
  // [COOPERATIVE BANKS]
  // =================================================================
  { name: "Saraswat Co-operative Bank", shortName: "SARASWAT", aliases: ["Saraswat Bank"], status: "ACTIVE", category: "COOPERATIVE" },
  { name: "Cosmos Co-operative Bank", shortName: "COSMOS", aliases: ["Cosmos Bank"], status: "ACTIVE", category: "COOPERATIVE" },
  { name: "Shamrao Vithal Co-operative Bank", shortName: "SVC", aliases: ["SVC Bank", "Shamrao Vithal Bank"], status: "ACTIVE", category: "COOPERATIVE" },

  // =================================================================
  // [FOREIGN BANKS IN INDIA]
  // =================================================================
  { name: "Citibank India", shortName: "CITI", aliases: ["Citibank", "Citi Bank"], status: "ACTIVE", category: "FOREIGN" },
  { name: "HSBC India", shortName: "HSBC", aliases: ["HSBC Bank"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Standard Chartered Bank", shortName: "SCB", aliases: ["Standard Chartered"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Deutsche Bank", shortName: "DEUTSCHE", aliases: ["Deutsche"], status: "ACTIVE", category: "FOREIGN" },
  { name: "DBS Bank India", shortName: "DBS", aliases: ["DBS Bank"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Barclays Bank", shortName: "BARCLAYS", aliases: ["Barclays"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Bank of America", shortName: "BOFA", aliases: ["Bank of America NA"], status: "ACTIVE", category: "FOREIGN" },
  { name: "JPMorgan Chase Bank", shortName: "JPM", aliases: ["JP Morgan", "JPMorgan"], status: "ACTIVE", category: "FOREIGN" },
  { name: "MUFG Bank", shortName: "MUFG", aliases: ["Bank of Tokyo Mitsubishi UFJ"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Mizuho Bank", shortName: "MIZUHO", aliases: ["Mizuho"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Sumitomo Mitsui Banking Corporation", shortName: "SMBC", aliases: ["Sumitomo Mitsui"], status: "ACTIVE", category: "FOREIGN" },
  { name: "SBM Bank India", shortName: "SBM", aliases: ["SBM Bank"], status: "ACTIVE", category: "FOREIGN" },
  { name: "First Abu Dhabi Bank", shortName: "FAB", aliases: ["FAB Bank"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Qatar National Bank", shortName: "QNB", aliases: ["QNB Bank"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Emirates NBD", shortName: "EMIRATES NBD", aliases: ["Emirates"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Woori Bank", shortName: "WOORI", aliases: ["Woori"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Shinhan Bank", shortName: "SHINHAN", aliases: ["Shinhan"], status: "ACTIVE", category: "FOREIGN" },
  { name: "Industrial and Commercial Bank of China", shortName: "ICBC", aliases: ["ICBC Bank"], status: "ACTIVE", category: "FOREIGN" },
];

const ACTIVE_BANKS = INDIAN_BANKS.filter((bank) => bank.status === "ACTIVE");

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bankTerms(bank: IndianBank): string[] {
  return [bank.name, bank.shortName, ...bank.aliases].map(normalize);
}

export function searchIndianBanks(query: string, limit = 100): IndianBank[] {
  const needle = normalize(query);
  if (!needle) return ACTIVE_BANKS.slice(0, limit);
  const words = needle.split(" ").filter(Boolean);

  const scored = ACTIVE_BANKS.map((bank) => {
    const terms = bankTerms(bank);
    let score = 0;
    for (const term of terms) {
      if (term === needle) score = Math.max(score, 100);
      else if (term.startsWith(needle)) score = Math.max(score, 80);
      else if (term.split(" ").some((word) => word.startsWith(needle))) score = Math.max(score, 65);
      else if (term.includes(needle)) score = Math.max(score, 45);
      else if (words.length > 1 && words.every((word) => term.includes(word))) score = Math.max(score, 30);
    }
    return { bank, score };
  })
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.bank.rank ?? 99) - (b.bank.rank ?? 99) ||
        a.bank.name.localeCompare(b.bank.name)
    );

  return scored.slice(0, limit).map((entry) => entry.bank);
}

/** Resolve any accepted name, abbreviation or alias to its canonical bank record. */
export function resolveIndianBank(input: string): IndianBank | null {
  const needle = normalize(input);
  if (!needle) return null;
  return (
    ACTIVE_BANKS.find((bank) => bankTerms(bank).some((term) => term === needle)) ?? null
  );
}

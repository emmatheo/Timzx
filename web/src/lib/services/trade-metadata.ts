/**
 * Descriptive trade metadata.
 *
 * The chain knows amounts, parties and state. It does not know that trade #3 is solar panels
 * moving from Shenzhen to Lagos — that lives here. The split is strict in both directions: this
 * module never returns a figure the chain is authoritative for, and nothing financial is read from
 * it.
 *
 * When Supabase is unconfigured the seed catalogue below is used instead, flagged `isSeed` so
 * every surface that renders it can label it as demo data.
 */
import {getSupabase} from '@/lib/supabase/client';
import type {TradeMetadata} from '@/types/trade';

/**
 * Illustrative corridors used to populate the marketplace before real trades exist.
 *
 * These describe what a trade would look like; they are not trades. They carry no id that maps to
 * a chain record, and the marketplace renders them in a clearly separated, labelled section rather
 * than mixed in with on-chain rows.
 */
export interface SeedListing {
  key: string;
  title: string;
  commodity: string;
  industry: string;
  originCountry: string;
  destinationCountry: string;
  supplierName: string;
  buyerName: string;
  incoterms: string;
  summary: string;
  /** Whole dollars. Converted to token units only if someone creates a real trade from it. */
  tradeValueUsd: number;
  collateralUsd: number;
  termDays: number;
  interestBps: number;
}

export const SEED_LISTINGS: readonly SeedListing[] = [
  {
    key: 'solar-panels',
    title: 'Solar Panels Import',
    commodity: 'Monocrystalline PV modules, 550W',
    industry: 'Renewable Energy',
    originCountry: 'China',
    destinationCountry: 'Nigeria',
    supplierName: 'SolarTech Ltd.',
    buyerName: 'Lagos Power Collective',
    incoterms: 'CIF Lagos',
    summary:
      'Container load of PV modules for a commercial rooftop programme in Lagos. Financing bridges the gap between supplier payment on dispatch and end-customer collections.',
    tradeValueUsd: 50_000,
    collateralUsd: 10_000,
    termDays: 90,
    interestBps: 800,
  },
  {
    key: 'construction-equipment',
    title: 'Construction Equipment',
    commodity: 'Excavator and attachments',
    industry: 'Construction',
    originCountry: 'Germany',
    destinationCountry: 'Kenya',
    supplierName: 'Rheinbau Maschinen GmbH',
    buyerName: 'Nairobi Civil Works',
    incoterms: 'FOB Hamburg',
    summary:
      'Single-unit heavy equipment purchase against a contracted infrastructure award, repaid from milestone drawdowns.',
    tradeValueUsd: 120_000,
    collateralUsd: 30_000,
    termDays: 120,
    interestBps: 950,
  },
  {
    key: 'textile-raw-materials',
    title: 'Textile Raw Materials',
    commodity: 'Combed cotton yarn, 30s',
    industry: 'Textiles',
    originCountry: 'India',
    destinationCountry: 'Ghana',
    supplierName: 'Coimbatore Spinners',
    buyerName: 'Accra Apparel Works',
    incoterms: 'CFR Tema',
    summary:
      'Recurring raw-material purchase for a garment manufacturer with seasonal working-capital gaps.',
    tradeValueUsd: 35_000,
    collateralUsd: 8_750,
    termDays: 60,
    interestBps: 650,
  },
  {
    key: 'agricultural-equipment',
    title: 'Agricultural Equipment',
    commodity: 'Tractors and tillage implements',
    industry: 'Agriculture',
    originCountry: 'Brazil',
    destinationCountry: 'Zambia',
    supplierName: 'AgroSul Equipamentos',
    buyerName: 'Copperbelt Farming Co-op',
    incoterms: 'CIF Durban',
    summary:
      'Mechanisation package for a farming co-operative, timed to the planting season and repaid post-harvest.',
    tradeValueUsd: 78_000,
    collateralUsd: 19_500,
    termDays: 180,
    interestBps: 1_100,
  },
  {
    key: 'industrial-machinery',
    title: 'Industrial Machinery',
    commodity: 'CNC machining centre',
    industry: 'Manufacturing',
    originCountry: 'Türkiye',
    destinationCountry: 'Egypt',
    supplierName: 'Anadolu Makine A.S.',
    buyerName: 'Cairo Precision Industries',
    incoterms: 'DAP Cairo',
    summary:
      'Capacity expansion for a precision components manufacturer supplying regional automotive assemblers.',
    tradeValueUsd: 210_000,
    collateralUsd: 63_000,
    termDays: 150,
    interestBps: 1_025,
  },
] as const;

function rowToMetadata(row: {
  trade_id: string;
  title: string;
  commodity: string;
  industry: string;
  origin_country: string;
  destination_country: string;
  supplier_name: string;
  buyer_name: string;
  incoterms: string | null;
  summary: string | null;
  is_seed: boolean;
}): TradeMetadata {
  return {
    tradeId: row.trade_id,
    title: row.title,
    commodity: row.commodity,
    industry: row.industry,
    originCountry: row.origin_country,
    destinationCountry: row.destination_country,
    supplierName: row.supplier_name,
    buyerName: row.buyer_name,
    incoterms: row.incoterms,
    summary: row.summary,
    isSeed: row.is_seed,
  };
}

/** Metadata for a set of on-chain trade ids. Missing entries are simply absent. */
export async function fetchTradeMetadata(
  tradeIds: readonly bigint[],
): Promise<Map<string, TradeMetadata>> {
  const result = new Map<string, TradeMetadata>();
  const supabase = getSupabase();
  if (!supabase || tradeIds.length === 0) return result;

  const {data, error} = await supabase
    .from('trade_metadata')
    .select('*')
    .in(
      'trade_id',
      tradeIds.map((id) => id.toString()),
    );

  if (error || !data) return result;
  for (const row of data) {
    result.set(row.trade_id, rowToMetadata(row));
  }
  return result;
}

/** Attaches descriptive metadata to a newly created trade. Best-effort: a failure never blocks. */
export async function saveTradeMetadata(
  metadata: TradeMetadata & {chainId: number},
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const {error} = await supabase.from('trade_metadata').upsert({
    trade_id: metadata.tradeId,
    chain_id: metadata.chainId,
    title: metadata.title,
    commodity: metadata.commodity,
    industry: metadata.industry,
    origin_country: metadata.originCountry,
    destination_country: metadata.destinationCountry,
    supplier_name: metadata.supplierName,
    buyer_name: metadata.buyerName,
    incoterms: metadata.incoterms,
    summary: metadata.summary,
    is_seed: metadata.isSeed,
  });

  return !error;
}

/** Placeholder metadata for a trade with no stored description, so tables never show blanks. */
export function placeholderMetadata(tradeId: bigint): TradeMetadata {
  return {
    tradeId: tradeId.toString(),
    title: `Trade #${tradeId}`,
    commodity: 'Not described',
    industry: 'Unspecified',
    originCountry: '—',
    destinationCountry: '—',
    supplierName: 'Unnamed supplier',
    buyerName: 'Unnamed buyer',
    incoterms: null,
    summary: null,
    isSeed: false,
  };
}

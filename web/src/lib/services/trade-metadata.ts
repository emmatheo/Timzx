/**
 * Descriptive trade metadata.
 *
 * The chain knows amounts, parties and state. It does not know that trade #3 is solar panels
 * moving from Shenzhen to Lagos — that lives here. The split is strict in both directions: this
 * module never returns a figure the chain is authoritative for, and nothing financial is read from
 * it.
 *
 * Every row here is descriptive metadata for a trade that exists on-chain. There is no catalogue
 * of example listings: a trade appears in the product because it was created on Creditcoin.
 */
import {getSupabase} from '@/lib/supabase/client';
import type {TradeMetadata} from '@/types/trade';

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
  };
}

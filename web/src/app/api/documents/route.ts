import {NextResponse} from 'next/server';
import {isAddress} from 'viem';

import {currentAddress} from '@/lib/server/session';
import {supabaseAdmin} from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

const HASH = /^0x[0-9a-fA-F]{64}$/;
const TRADE_ID = /^\d{1,78}$/;
const MAX_NAME = 200;

const DOCUMENT_TYPES = new Set([
  'Invoice',
  'Purchase Order',
  'Bill of Lading',
  'Shipping Confirmation',
  'Delivery Confirmation',
  'Certificate of Origin',
  'Insurance Certificate',
]);

/** Documents anchored against a trade. Readable without a session; the register is public. */
export async function GET(request: Request) {
  const tradeId = new URL(request.url).searchParams.get('tradeId');
  if (!tradeId || !TRADE_ID.test(tradeId)) {
    return NextResponse.json({error: 'A numeric tradeId is required.'}, {status: 400});
  }

  const {data, error} = await supabaseAdmin()
    .from('documents')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', {ascending: false});

  if (error) return NextResponse.json({error: 'Could not load documents.'}, {status: 500});
  return NextResponse.json({documents: data ?? []});
}

/**
 * Registers a document hash against a trade.
 *
 * Takes the digest, never the file. The browser hashes locally and sends only the result, so the
 * server stores something that proves the paperwork has not changed without ever holding the
 * paperwork. `uploaded_by` is taken from the session, not the request body — otherwise anyone
 * could attribute a document to any wallet.
 */
export async function POST(request: Request) {
  const address = await currentAddress();
  if (!address) {
    return NextResponse.json({error: 'Sign in with your wallet first.'}, {status: 401});
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({error: 'Malformed request body.'}, {status: 400});
  }

  const tradeId = body.tradeId;
  const name = body.name;
  const documentType = body.documentType;
  const contentHash = body.contentHash;
  const storageCid = body.storageCid ?? null;

  if (typeof tradeId !== 'string' || !TRADE_ID.test(tradeId)) {
    return NextResponse.json({error: 'A numeric tradeId is required.'}, {status: 400});
  }
  if (typeof name !== 'string' || name.length === 0 || name.length > MAX_NAME) {
    return NextResponse.json({error: `A name of 1-${MAX_NAME} characters is required.`}, {status: 400});
  }
  if (typeof documentType !== 'string' || !DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json({error: 'Unrecognised document type.'}, {status: 400});
  }
  if (typeof contentHash !== 'string' || !HASH.test(contentHash)) {
    return NextResponse.json({error: 'A keccak256 content hash is required.'}, {status: 400});
  }
  if (storageCid !== null && typeof storageCid !== 'string') {
    return NextResponse.json({error: 'storageCid must be a string when provided.'}, {status: 400});
  }
  if (!isAddress(address)) {
    return NextResponse.json({error: 'Session address is malformed.'}, {status: 401});
  }

  const {data, error} = await supabaseAdmin()
    .from('documents')
    .insert({
      trade_id: tradeId,
      name,
      document_type: documentType,
      content_hash: contentHash,
      storage_cid: storageCid,
      uploaded_by: address,
    })
    .select()
    .single();

  if (error) return NextResponse.json({error: 'Could not register the document.'}, {status: 500});
  return NextResponse.json({document: data}, {status: 201});
}

import {keccak256, toHex} from 'viem';

import type {DocumentRecord} from '@/types/trade';

interface DocumentRow {
  id: string;
  trade_id: string;
  name: string;
  document_type: string;
  content_hash: string | null;
  storage_cid: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface RegisterDocumentInput {
  tradeId: string;
  name: string;
  documentType: string;
  contentHash: `0x${string}`;
}

function toRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    tradeId: row.trade_id,
    name: row.name,
    documentType: row.document_type,
    contentHash: (row.content_hash as `0x${string}` | null) ?? null,
    storageCid: row.storage_cid,
    uploadedBy: (row.uploaded_by as `0x${string}` | null) ?? null,
    uploadedAt: row.created_at,
    anchored: row.content_hash !== null,
  };
}

/**
 * Trade documents.
 *
 * Hashes in the browser and sends only the digest. The file itself is never transmitted, so the
 * record proves a document has not been altered without the service ever holding the document —
 * which is the point, given what trade paperwork contains.
 *
 * Writes go through a route handler that establishes the caller's wallet from a signed session;
 * the uploader is taken from that session, never from anything this client sends.
 */
export class DocumentService {
  /** Computes the anchor digest. The bytes never leave the device. */
  static async hash(file: File): Promise<`0x${string}`> {
    const buffer = await file.arrayBuffer();
    return keccak256(toHex(new Uint8Array(buffer)));
  }

  async list(tradeId: string): Promise<DocumentRecord[]> {
    const response = await fetch(`/api/documents?tradeId=${encodeURIComponent(tradeId)}`);
    const payload = (await response.json()) as {documents?: DocumentRow[]; error?: string};
    if (!response.ok) throw new Error(payload.error ?? 'Could not load documents.');
    return (payload.documents ?? []).map(toRecord);
  }

  async register(input: RegisterDocumentInput): Promise<DocumentRecord | null> {
    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as {document?: DocumentRow; error?: string};
    if (!response.ok) throw new Error(payload.error ?? 'Could not register the document.');
    return payload.document ? toRecord(payload.document) : null;
  }
}

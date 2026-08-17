'use client';

import {useMemo, useState} from 'react';
import {FileText, Link2, Upload} from 'lucide-react';
import {keccak256, toHex} from 'viem';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardHeader} from '@/components/ui/card';
import {Copyable} from '@/components/ui/copyable';
import {Field, Select, TextInput} from '@/components/ui/field';
import {Modal} from '@/components/ui/modal';
import {EmptyState} from '@/components/ui/states';
import {useMyTrades} from '@/hooks/use-protocol';
import {useTradeViews} from '@/hooks/use-trade-views';
import {formatDateTime, shortenHash} from '@/lib/format';

const DOCUMENT_TYPES = [
  'Invoice',
  'Purchase Order',
  'Bill of Lading',
  'Shipping Confirmation',
  'Delivery Confirmation',
  'Certificate of Origin',
  'Insurance Certificate',
] as const;

interface LocalDocument {
  id: string;
  tradeId: string;
  name: string;
  documentType: string;
  contentHash: `0x${string}`;
  uploadedAt: number;
  sizeBytes: number;
}

/**
 * Trade documents.
 *
 * Files are never put on-chain. What matters on-chain is the digest: a document is hashed in the
 * browser, and that hash is what gets anchored against the trade. Anyone holding the original file
 * can recompute the hash and check it matches, which is the whole point — the chain proves the
 * paperwork has not changed, without publishing the paperwork.
 *
 * In this build documents are held in session state; wiring the `documents` table and Supabase
 * Storage replaces the state hook without changing anything about the hashing.
 */
export default function DocumentsPage() {
  const {trades: entries} = useMyTrades();
  const views = useTradeViews(entries);
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tradeFilter, setTradeFilter] = useState('all');

  const visible = useMemo(
    () => (tradeFilter === 'all' ? documents : documents.filter((doc) => doc.tradeId === tradeFilter)),
    [documents, tradeFilter],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Documents</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
            Trade paperwork stays off-chain. Only its cryptographic digest is anchored, so the
            record proves a document has not been altered without publishing its contents.
          </p>
        </div>
        <Button size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>
          Add document
        </Button>
      </header>

      <Card>
        <CardHeader
          title="Document register"
          action={
            <Select
              value={tradeFilter}
              onChange={(event) => setTradeFilter(event.target.value)}
              className="h-8 w-auto text-[13px]"
            >
              <option value="all">All trades</option>
              {views.map(({chain, meta}) => (
                <option key={chain.id.toString()} value={chain.id.toString()}>
                  {meta?.title ?? `Trade #${chain.id}`}
                </option>
              ))}
            </Select>
          }
        />
        {visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents registered"
            description="Add an invoice, purchase order or bill of lading to anchor its hash against a trade."
            action={
              <Button size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>
                Add document
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-overlay">
                  <FileText className="size-4 text-ink-muted" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-medium text-ink">{doc.name}</p>
                    <Badge tone="neutral">{doc.documentType}</Badge>
                    <Badge tone="info" icon={Link2}>
                      Hash computed
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-subtle">
                    Trade #{doc.tradeId} · {(doc.sizeBytes / 1024).toFixed(1)} KB ·{' '}
                    {formatDateTime(new Date(doc.uploadedAt))}
                  </p>
                  <div className="mt-1.5">
                    <Copyable value={doc.contentHash} display={shortenHash(doc.contentHash)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <UploadModal
        open={uploadOpen}
        trades={views.map(({chain, meta}) => ({
          id: chain.id.toString(),
          label: meta?.title ?? `Trade #${chain.id}`,
        }))}
        onClose={() => setUploadOpen(false)}
        onAdd={(doc) => {
          setDocuments((current) => [doc, ...current]);
          setUploadOpen(false);
        }}
      />
    </div>
  );
}

function UploadModal({
  open,
  trades,
  onClose,
  onAdd,
}: {
  open: boolean;
  trades: {id: string; label: string}[];
  onClose: () => void;
  onAdd: (doc: LocalDocument) => void;
}) {
  const [tradeId, setTradeId] = useState('');
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file || !tradeId) {
      setError('Select a trade and a file.');
      return;
    }
    try {
      setBusy(true);
      // Hashing happens in the browser: the file itself never leaves the device in this build.
      const buffer = await file.arrayBuffer();
      const contentHash = keccak256(toHex(new Uint8Array(buffer)));
      onAdd({
        id: `${Date.now()}`,
        tradeId,
        name: file.name,
        documentType,
        contentHash,
        uploadedAt: Date.now(),
        sizeBytes: file.size,
      });
      setFile(null);
      setError(null);
    } catch {
      setError('Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add trade document"
      description="The file is hashed locally. Only the digest is recorded."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Compute hash and register
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Trade" error={error && !tradeId ? error : null}>
          <Select value={tradeId} onChange={(event) => setTradeId(event.target.value)}>
            <option value="">Select a trade</option>
            {trades.map((trade) => (
              <option key={trade.id} value={trade.id}>
                {trade.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Document type">
          <Select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="File"
          hint="Never uploaded in this build. The browser reads it, computes a keccak256 digest, and discards the contents."
          error={error && tradeId && !file ? error : null}
        >
          <TextInput
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-overlay file:px-3 file:py-1 file:text-[13px] file:text-ink"
          />
        </Field>
      </div>
    </Modal>
  );
}

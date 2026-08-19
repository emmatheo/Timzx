'use client';

import {useState} from 'react';
import {FileText, Link2, Upload} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardHeader} from '@/components/ui/card';
import {Copyable} from '@/components/ui/copyable';
import {Field, Select, TextInput} from '@/components/ui/field';
import {Modal} from '@/components/ui/modal';
import {EmptyState, LoadingState} from '@/components/ui/states';
import {hashFile, useDocuments} from '@/hooks/use-documents';
import {useMyTrades} from '@/hooks/use-protocol';
import {useSession} from '@/hooks/use-session';
import {useTradeViews} from '@/hooks/use-trade-views';
import {formatDateTime, shortenAddress, shortenHash} from '@/lib/format';

const DOCUMENT_TYPES = [
  'Invoice',
  'Purchase Order',
  'Bill of Lading',
  'Shipping Confirmation',
  'Delivery Confirmation',
  'Certificate of Origin',
  'Insurance Certificate',
] as const;

/**
 * Trade documents.
 *
 * Files are never uploaded and never put on-chain. The browser computes a keccak256 digest and
 * only that digest is stored, so anyone holding the original can recompute it and prove the
 * paperwork has not been altered — without the paperwork ever leaving their machine.
 */
export default function DocumentsPage() {
  const {trades: entries} = useMyTrades();
  const views = useTradeViews(entries);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const {documents, isLoading, register, isRegistering} = useDocuments(tradeId);
  const {authenticated, signIn, isSigningIn} = useSession();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Documents</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
            Trade paperwork stays with you. Only its cryptographic digest is stored, so the record
            proves a document has not changed without disclosing its contents.
          </p>
        </div>
        <Button
          size="sm"
          icon={Upload}
          disabled={tradeId === null}
          onClick={() => setUploadOpen(true)}
        >
          Add document
        </Button>
      </header>

      <Card>
        <CardHeader
          title="Document register"
          description={
            tradeId === null ? 'Select a trade to view its documents.' : `Trade #${tradeId}`
          }
          action={
            <Select
              value={tradeId ?? ''}
              onChange={(event) => setTradeId(event.target.value || null)}
              className="h-8 w-auto text-[13px]"
            >
              <option value="">Select a trade</option>
              {views.map(({chain, meta}) => (
                <option key={chain.id.toString()} value={chain.id.toString()}>
                  {meta?.title ?? `Trade #${chain.id}`}
                </option>
              ))}
            </Select>
          }
        />

        {tradeId === null ? (
          <EmptyState
            icon={FileText}
            title="No trade selected"
            description="Choose one of your trades to see the documents anchored against it."
          />
        ) : isLoading ? (
          <LoadingState label="Loading documents" />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents registered"
            description="Register an invoice, purchase order or bill of lading to anchor its hash against this trade."
            action={
              <Button size="sm" icon={Upload} onClick={() => setUploadOpen(true)}>
                Add document
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-overlay">
                  <FileText className="size-4 text-ink-muted" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-medium text-ink">{doc.name}</p>
                    <Badge tone="neutral">{doc.documentType}</Badge>
                    {doc.anchored ? (
                      <Badge tone="info" icon={Link2}>
                        Hash anchored
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-subtle">
                    {doc.uploadedBy ? `${shortenAddress(doc.uploadedBy)} · ` : ''}
                    {formatDateTime(new Date(doc.uploadedAt))}
                  </p>
                  {doc.contentHash ? (
                    <div className="mt-1.5">
                      <Copyable value={doc.contentHash} display={shortenHash(doc.contentHash)} />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <UploadModal
        open={uploadOpen}
        tradeId={tradeId}
        busy={isRegistering}
        authenticated={authenticated}
        isSigningIn={isSigningIn}
        onSignIn={signIn}
        onClose={() => setUploadOpen(false)}
        onRegister={async (input) => {
          await register(input);
          setUploadOpen(false);
        }}
      />
    </div>
  );
}

function UploadModal({
  open,
  tradeId,
  busy,
  authenticated,
  isSigningIn,
  onSignIn,
  onClose,
  onRegister,
}: {
  open: boolean;
  tradeId: string | null;
  busy: boolean;
  authenticated: boolean;
  isSigningIn: boolean;
  onSignIn: () => void;
  onClose: () => void;
  onRegister: (input: {
    tradeId: string;
    name: string;
    documentType: string;
    contentHash: `0x${string}`;
  }) => Promise<void>;
}) {
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);

  const submit = async () => {
    if (!file || !tradeId) {
      setError('Select a file.');
      return;
    }
    try {
      setHashing(true);
      setError(null);
      const contentHash = await hashFile(file);
      await onRegister({tradeId, name: file.name, documentType, contentHash});
      setFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read that file.');
    } finally {
      setHashing(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register trade document"
      description="The file is hashed in your browser. Only the digest is sent."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy || hashing}>
            Cancel
          </Button>
          {authenticated ? (
            <Button loading={busy || hashing} onClick={() => void submit()}>
              Compute hash and register
            </Button>
          ) : (
            <Button loading={isSigningIn} onClick={onSignIn}>
              Sign in to register
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
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
          hint="Read locally to compute a keccak256 digest, then discarded. Nothing is uploaded."
          error={error}
        >
          <TextInput
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-overlay file:px-3 file:py-1 file:text-[13px] file:text-ink"
          />
        </Field>

        {!authenticated ? (
          <p className="text-[12.5px] leading-relaxed text-ink-subtle">
            Registering a document requires a signature proving you control this wallet. It
            authorises no transaction and moves no funds.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

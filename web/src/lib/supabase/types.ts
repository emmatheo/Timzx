/**
 * Supabase schema types.
 *
 * Mirrors `supabase/schema.sql`. Kept hand-written and small rather than generated, because the
 * frontend only touches a narrow slice: descriptive metadata, documents, messages and profiles.
 * Anything financial is read from the chain and never duplicated here.
 */
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          country: string;
          industry: string | null;
          kyb_status: 'unverified' | 'pending' | 'verified';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          wallet_address: string;
          display_name: string | null;
          role: 'buyer' | 'supplier' | 'financier';
          organization_id: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      trade_metadata: {
        Row: {
          trade_id: string;
          chain_id: number;
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
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['trade_metadata']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['trade_metadata']['Insert']>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          trade_id: string;
          name: string;
          document_type: string;
          content_hash: string | null;
          storage_cid: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
        Relationships: [];
      };
      shipments: {
        Row: {
          id: string;
          trade_id: string;
          carrier: string | null;
          tracking_reference: string | null;
          origin_port: string | null;
          destination_port: string | null;
          dispatched_at: string | null;
          estimated_arrival: string | null;
          delivered_at: string | null;
          source_tx_hash: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['shipments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['shipments']['Insert']>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          trade_id: string | null;
          sender_address: string;
          body: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
        Relationships: [];
      };
      attestation_index: {
        Row: {
          attestation_id: string;
          trade_id: string;
          event_kind: number;
          proof_kind: number;
          source_chain_key: number;
          source_height: string;
          source_tx_hash: string;
          creditcoin_tx_hash: string | null;
          recorded_at: string;
        };
        Insert: Database['public']['Tables']['attestation_index']['Row'];
        Update: Partial<Database['public']['Tables']['attestation_index']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

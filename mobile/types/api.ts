export type AppConfig = {
  feature_flags: {
    account_signup_enabled?: boolean;
    purchase_enabled?: boolean;
    invoice_claims_enabled?: boolean;
  };
  emergency: {
    national_hotline?: string;
    er_hotline?: string;
    concierge_hotline?: string;
  };
  legal_urls: {
    privacy_url?: string;
    terms_url?: string;
    coverage_terms_url?: string;
  };
  hosted_shop_url?: string;
  min_supported_version?: string;
  checkout_return_scheme?: string;
  pricing?: {
    currency?: string;
    products?: Record<string, { amount_centavos: number }>;
  };
  charge_amount_centavos?: Record<string, number>;
  coverage_waiting_days?: number;
};

export type AccountCapabilities = {
  can_purchase: boolean;
  can_link_card: boolean;
  can_file_claim: boolean;
};

export type Account = {
  id: number;
  username?: string;
  email: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  birthday: string;
  mobile_number: string;
  philhealth_number?: string | null;
  government_id_number?: string | null;
  notify_renewal?: boolean;
  notify_sms?: boolean;
  has_photo?: boolean;
  email_verified_at?: string | null;
  identity_locked: boolean;
  has_linked_cards: boolean;
  coverage_starts_on?: string | null;
  capabilities?: AccountCapabilities;
};

export type Session = {
  access_token: string;
  token_type: string;
  expires_at: string;
};

export type ErGuardCard = {
  card_key: string;
  activation_id: number;
  card_number_masked: string;
  policy_number_masked?: string | null;
  er_guard_type: string;
  status?: string;
  is_pending: boolean;
  is_expired: boolean;
  is_utilized: boolean;
  activated_at?: string | null;
  effective_date?: string | null;
  expiration_date?: string | null;
  member_name?: string | null;
  /** Server may serialize the coverage limit as a number or a string. */
  limit_value?: string | number | null;
  artwork_type: 'standard' | 'plus';
  /** Per-member artwork key (stamped at issuance). NULL = legacy card. */
  card_design_key?: string | null;
  allowed_actions: string[];
};

export type Facility = {
  id: number;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number | null;
  contact?: string | null;
};

export type ClaimAttachment = {
  id: number;
  name: string;
  mime?: string;
  size?: number;
};

export type ClaimTicket = {
  id: number;
  ref: string;
  hospital: string;
  date: string | null;
  coverage: string;
  amount: number | null;
  status: 'in-review' | 'settled';
  detail?: string | null;
  attachment_count?: number;
  loa_type?: string | null;
  request_type?: string | null;
  /** Filing surface: 'er_guard_app' | 'medicare_plus_app' (null = legacy). */
  source_app?: string | null;
  visit_date?: string | null;
  claimed_amount?: number | null;
  chief_complaint?: string | null;
  diagnosis_description?: string | null;
  member_name?: string | null;
  ocr_status?: string | null;
  ocr_review_required?: boolean;
  name_review_acknowledged?: boolean;
  attachments?: ClaimAttachment[];
};

export type ClaimVoucher = ClaimTicket & {
  member_name?: string | null;
  email?: string | null;
};

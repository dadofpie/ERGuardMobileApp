export type AppConfig = {
  feature_flags: {
    account_signup_enabled?: boolean;
    purchase_enabled?: boolean;
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
};

export type Account = {
  id: number;
  email: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  birthday: string;
  mobile_number: string;
  email_verified_at?: string | null;
  identity_locked: boolean;
  has_linked_cards: boolean;
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
  limit_value?: string | null;
  artwork_type: 'standard' | 'plus';
  allowed_actions: string[];
};

export type Facility = {
  id: number;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  is_accredited?: boolean;
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
};

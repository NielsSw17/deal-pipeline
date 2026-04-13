export const STAGES = ['Sourcing', 'Screening', 'IC', 'Due Diligence', 'Signed', 'Closed', 'Lost']

// Forward-progression order (Lost excluded from gate logic)
export const STAGE_ORDER = ['Sourcing', 'Screening', 'IC', 'Due Diligence', 'Signed', 'Closed']

export const STAGE_COLORS = {
  Sourcing:        { bar: '#3b82f6', bg: '#eff6ff', color: '#3b82f6' },
  Screening:       { bar: '#8b5cf6', bg: '#f5f3ff', color: '#8b5cf6' },
  IC:              { bar: '#f59e0b', bg: '#fffbeb', color: '#f59e0b' },
  'Due Diligence': { bar: '#f97316', bg: '#fff7ed', color: '#f97316' },
  Signed:          { bar: '#06b6d4', bg: '#ecfeff', color: '#06b6d4' },
  Closed:          { bar: '#10b981', bg: '#f0fdf4', color: '#10b981' },
  Lost:            { bar: '#94a3b8', bg: '#f8fafc', color: '#94a3b8' },
}

// Stage progression gate rules
// key = "FromStage→ToStage", only applies when moving exactly one step forward
export const STAGE_GATES = {
  'Sourcing→Screening': {
    title: 'Move to Screening',
    description: 'Complete before screening this deal',
    checks: [
      {
        key: 'sourcing',
        label: 'Deal sourcing',
        type: 'select',
        options: ['Proprietary', 'Auction', 'Referral', 'Co-investor'],
      },
      {
        key: 'thesis',
        label: 'Investment thesis (one-liner)',
        type: 'textarea',
        placeholder: 'e.g. Market leader in cold-chain logistics for fresh produce…',
      },
    ],
  },
  'Screening→IC': {
    title: 'Request IC',
    description: 'Complete before presenting to the Investment Committee',
    checks: [
      { key: 'ev',     label: 'EV estimate (€m)', type: 'number' },
      {
        key: 'sector',
        label: 'Sector',
        type: 'select',
        options: ['Technology', 'Healthcare', 'Financial Services', 'Consumer',
                  'Industrials', 'Energy', 'Real Estate', 'Media & Entertainment', 'Education', 'Other'],
      },
    ],
  },
  'IC→Due Diligence': {
    title: 'Start Due Diligence',
    description: 'Complete before commencing due diligence',
    checks: [
      { key: 'ic_date', label: 'IC meeting date', type: 'date' },
      { key: 'ic_memo', label: 'IC memo (PDF)',    type: 'file' },
    ],
  },
  'Due Diligence→Signed': {
    title: 'Mark as Signed',
    description: 'Upload the signed term sheet to proceed',
    checks: [
      { key: 'term_sheet', label: 'Signed term sheet (PDF)', type: 'file' },
    ],
  },
  'Signed→Closed': {
    title: 'Close Deal',
    description: 'Confirm final deal parameters',
    checks: [
      { key: 'ev',           label: 'Final EV (€m)',        type: 'number' },
      { key: 'ownership_pct',label: 'Ownership % acquired', type: 'number' },
      { key: 'close_date',   label: 'Close date',           type: 'date'   },
    ],
  },
}

export const TEAM = ['Hans', 'Mark', 'Niels', 'Pauline', 'Bart', 'Pieter', 'Henk']

export const OWNER_COLORS = {
  Hans:    '#3b82f6',
  Mark:    '#8b5cf6',
  Niels:   '#021d49',
  Pauline: '#ec4899',
  Bart:    '#f97316',
  Pieter:  '#10b981',
  Henk:    '#62b790',
}

export const THEMES = [
  { value: 'Energy', color: '#b45309', bg: '#fffbeb', dot: '#f59e0b' },
  { value: 'Food',   color: '#15803d', bg: '#f0fdf4', dot: '#22c55e' },
  { value: 'Health', color: '#0f766e', bg: '#f0fdfa', dot: '#14b8a6' },
]

export const SOURCING_OPTIONS = [
  { value: 'Proprietary', color: '#ffffff', bg: '#021d49' },
  { value: 'Auction',     color: '#92400e', bg: '#fef3c7' },
  { value: 'Referral',    color: '#6b21a8', bg: '#f3e8ff' },
  { value: 'Co-investor', color: '#134e4a', bg: '#ccfbf1' },
]

export const CRITERIA = [
  { key: 'crit_thematic',   label: 'Thematic fit (Energy / Food / Health)' },
  { key: 'crit_technology', label: 'Technology-enabled business model' },
  { key: 'crit_commercial', label: 'Proven commercial traction' },
  { key: 'crit_geography',  label: 'Geography within scope (NL/BE/DE/DK/SE)' },
  { key: 'crit_majority',   label: 'Majority / significant minority stake possible' },
  { key: 'crit_ticket',     label: 'Ticket size €10m–€75m equity' },
]

export const SECTORS = [
  'Technology', 'Healthcare', 'Financial Services', 'Consumer', 'Industrials',
  'Energy', 'Real Estate', 'Media & Entertainment', 'Education', 'Other',
]

export const COUNTRIES = [
  'Netherlands', 'Germany', 'United Kingdom', 'France', 'Belgium', 'Sweden',
  'Denmark', 'Norway', 'Finland', 'Switzerland', 'Spain', 'Italy', 'United States',
  'Other',
]

export const GEOGRAPHIES = ['NL', 'DE', 'BE', 'DK', 'SE', 'NO', 'UK', 'Other']

export const DEAL_SOURCES = ['Outbound', 'Inbound', 'Referral', 'Co-investor']

export const LOST_REASONS = [
  'Valuation too high',
  'Mandate mismatch',
  'Lost to competitor',
  'No formal process',
  'Management concerns',
  'Geography outside scope',
  'Technology not proven',
  'Too early stage',
  'Deal fell through',
  'Other',
]

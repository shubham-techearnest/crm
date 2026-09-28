export const LEAD_SALUTATIONS = ["", "Mr.", "Mrs.", "Ms.", "Dr.", "Prof."] as const;

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const;

export const LEAD_SOURCES = [
  "",
  "Advertisement",
  "Cold Call",
  "Employee Referral",
  "External Referral",
  "Online Store",
  "Partner",
  "Public Relations",
  "Seminar Partner",
  "Trade Show",
  "Web",
  "Word of mouth",
  "Other",
] as const;

export const LEAD_INDUSTRIES = [
  "",
  "ASP",
  "Data/Telecom OEM",
  "ERP",
  "Government/Military",
  "Large Enterprise",
  "ManagementISV",
  "MSP (Management Service Provider)",
  "Network Equipment Enterprise",
  "Non-management ISV",
  "Optical Networking",
  "Service Provider",
  "Small/Medium Enterprise",
  "Storage Equipment",
  "Storage Service Provider",
  "Systems Integrator",
  "Wireless Industry",
] as const;

export const LEAD_RATINGS = [
  "",
  "Acquired",
  "Active",
  "Market Failed",
  "Project Cancelled",
  "Shut Down",
] as const;

export const LEAD_COUNTRIES = [
  "",
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Singapore",
  "United Arab Emirates",
  "Germany",
  "France",
] as const;

export const LEAD_STATES = [
  "",
  "Andhra Pradesh",
  "Delhi",
  "Gujarat",
  "Karnataka",
  "Kerala",
  "Maharashtra",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
] as const;

export function noneLabel(value: string) {
  return value === "" ? "—None—" : value;
}

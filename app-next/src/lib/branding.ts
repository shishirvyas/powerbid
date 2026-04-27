export const APP_NAME = "BID";
export const APP_SUBTITLE = "Quotation Suite";

export const COMPANY_NAME = "LAN Engineering & Technologies";
export const COMPANY_TAGLINE = "An ISO 9001:2015 Certified Company";
export const COMPANY_CREDENTIALS = [
  "Electrical and Industrial Solutions Supplier",
  "Authorized Channel and Project Execution Partner",
];

export const COMPANY_ADDRESS = "B-07 & B-17, Sector-83, Noida-201305, (U.P) INDIA";
export const COMPANY_MFG_LINE =
  "Mfg Of : AB Cable Accessories, LT Cable, & Energy Meters, SMC, Deep Drawn, Polycarbonate LT Distribution Boxes & Meter Boxes.";

export const COMPANY_GSTIN = process.env.COMPANY_GSTIN || "27ABCDE1234F1Z5";
export const COMPANY_PAN = process.env.COMPANY_PAN || "ABCDE1234F";
export const COMPANY_PHONE = process.env.COMPANY_PHONE || "+91-9811520225";
export const COMPANY_EMAIL = process.env.COMPANY_EMAIL || "lantechnoida@gmail.com";
export const COMPANY_EMAIL2 = process.env.COMPANY_EMAIL2 || "Sale@lanengineering.in";
export const COMPANY_WEBSITE = process.env.COMPANY_WEBSITE || "www.lanengineering.in";

export const DEFAULT_SIGNER_NAME = "Deepak Virwal";
export const DEFAULT_SIGNER_DESIGNATION = "GM- Sales & Marketing";
export const DEFAULT_SIGNER_MOBILE = "9667066229";

export type SignaturePreset = {
  id: string;
  label: string;
  name: string;
  designation: string;
  mobile: string;
  email: string;
};

// Prepopulated authorised signatories — pick one from the quotation form to
// auto-fill the signature block. Add or edit entries here to manage your
// in-house "signature master".
export const SIGNATURE_PRESETS: SignaturePreset[] = [
  {
    id: "deepak",
    label: "Deepak Virwal — GM Sales & Marketing",
    name: "Deepak Virwal",
    designation: "GM - Sales & Marketing",
    mobile: "9667066229",
    email: "sale@lanengineering.in",
  },
  {
    id: "director",
    label: "Authorised Signatory — Director",
    name: "Authorised Signatory",
    designation: "Director",
    mobile: "+91-9811520225",
    email: "lantechnoida@gmail.com",
  },
  {
    id: "sales",
    label: "Sales Desk",
    name: "Sales Desk",
    designation: "Sales & Marketing",
    mobile: "+91-9811520225",
    email: "sale@lanengineering.in",
  },
];

export const BRAND_SUPPORT_EMAIL = "support@lanengineering.in";

export const AUTH_ISSUER = process.env.JWT_ISSUER || "bid";

export const DEMO_DOMAIN = "bid.local";
export const DEMO_USERS = {
  admin: `admin@${DEMO_DOMAIN}`,
  sales: `sales@${DEMO_DOMAIN}`,
  viewer: `viewer@${DEMO_DOMAIN}`,
} as const;

export const DEFAULT_SEED_KEY = "bid-demo";

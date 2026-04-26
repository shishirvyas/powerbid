import { COMPANY_NAME } from "@/lib/branding";

export const DEFAULT_INTRO_PARAGRAPH =
  "We thankfully acknowledge receipt of your enquiry and are pleased to submit our optimum offer for your kind consideration. We trust our offer will meet your technical and commercial expectations and we look forward to your valued response.";

export const DEFAULT_SUBJECT = "Quotation for Supply Scope";

export const DEFAULT_COMMERCIAL_TERMS = [
  "Scope: Supply as per enclosed price schedule.",
  "Validity: Offer valid for 15 days from date of quotation.",
  "GST: GST extra as applicable at the time of invoicing.",
  "Freight: Extra at actual, unless specified otherwise.",
  "Payment Terms: 100% against Proforma Invoice / mutually agreed terms.",
  "Delivery: 2 to 4 weeks from receipt of confirmed order.",
  "Force Majeure: Subject to force majeure conditions.",
  "Warranty: Standard OEM warranty terms apply.",
  "Packing: Standard transit-worthy packing included.",
  "Insurance: To customer account unless otherwise agreed.",
  "Inspection: Pre-dispatch inspection at our works, if required.",
].join("\n");

export const DEFAULT_SIGNATURE_BLOCK = [
  "We remain,",
  "Sportingly yours,",
  `For ${COMPANY_NAME}`,
].join("\n");

export const DEFAULT_ENCLOSURES = ["1 Price Schedule", "2 Commercial Terms & Conditions"];

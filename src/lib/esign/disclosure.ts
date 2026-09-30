// Versioned text shown verbatim to the signer and retained with completion evidence.
export const DISCLOSURE_VERSION = "2026-09-30.1";
export const DISCLOSURE_TEXT =
  "For this document, I choose to use electronic records and signatures. I can open, read, download and retain this PDF using a current browser and PDF reader, and I have an email address and a device with storage or printing access. I may decline electronic signing or withdraw this consent before signing by choosing Decline to sign and contacting the sender. I can contact the sender to request a paper copy or another signing method and ask about any related fees, or to update my contact details. This consent applies only to this document. Withdrawing consent does not undo records already signed. By selecting Finish & Sign, I intend to sign this document using my adopted signature, and confirm that I am the named signer and, if signing for a business, am authorized to bind that business.";
export function isFullNameField(box: { label?: string }) {
  return /^full name(?:\s*[—–(\-]|$)/i.test(box.label?.trim() ?? "");
}

/**
 * Contact validation rules — ported from the SF org's Contact object.
 *
 * Standard SF Contact does not have validation rule XML in the export, but the
 * Contact picklist + required-fields metadata defines what the SF UI enforces.
 */

export type ContactRecord = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  primaryAccountId?: string | null;
};

export type ContactPatch = Partial<{
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  primaryAccountId: string | null;
}>;

export function validateContactPatch(existing: ContactRecord, patch: ContactPatch): string[] {
  const errors: string[] = [];

  // Rule 1 (Last_Name_Required): SF Contact.LastName is required and cannot
  // be blanked out on edit.
  if (patch.lastName !== undefined) {
    if (!patch.lastName || patch.lastName.trim() === "") {
      errors.push("Last Name is required.");
    }
  }

  // Rule 2 (Email_Format): if set, must be a valid email.
  if (patch.email !== undefined && patch.email !== null && patch.email !== "") {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email);
    if (!ok) errors.push("Email must be a valid email address.");
  }

  // Rule 3 (Phone_Or_Mobile_Required):
  // A Contact must keep at least one reachable number. If the user blanks out
  // both Phone and Mobile, the SF page reminds them at least one is required.
  if (patch.phone !== undefined || patch.mobilePhone !== undefined) {
    const nextPhone = patch.phone !== undefined ? patch.phone : existing.phone;
    const nextMobile = patch.mobilePhone !== undefined ? patch.mobilePhone : existing.mobilePhone;
    const noPhone = !nextPhone || nextPhone.trim() === "";
    const noMobile = !nextMobile || nextMobile.trim() === "";
    // Only fire if the existing record had at least one number — preserves
    // grandfathered records that came in with neither populated.
    const hadAny = !!existing.phone || !!existing.mobilePhone;
    if (hadAny && noPhone && noMobile) {
      errors.push("Phone or Mobile Phone is required on a Contact.");
    }
  }

  // Rule 4 (No_Self_Parent_Account):
  // A Contact cannot have its own id as its primary account id (defensive
  // check; the FK is to Account, not Contact, but legacy migration occasionally
  // saw stray Contact ids in this column).
  if (patch.primaryAccountId !== undefined && patch.primaryAccountId === existing.id) {
    errors.push("Primary Account cannot be the Contact itself.");
  }

  return errors;
}

export const CONTACT_RULE_COUNT = 4;

import { prisma } from "@/lib/prisma";

/**
 * Permission keys follow the pattern `Entity.Action`.
 * Mirrors Salesforce profile + permset model: a user's effective permissions are
 * the union of their Profile's permission sets and any directly-assigned permission sets,
 * plus permission sets reached via Permission Set Groups.
 */

export const PERMISSION_CATALOG = [
  // Lead
  "Lead.View", "Lead.Create", "Lead.Edit", "Lead.Delete", "Lead.Convert", "Lead.Import", "Lead.MassReassign", "Lead.ViewAll", "Lead.ModifyAll",
  // Opportunity
  "Opportunity.View", "Opportunity.Create", "Opportunity.Edit", "Opportunity.Delete", "Opportunity.ViewAll", "Opportunity.ModifyAll", "Opportunity.EditLocked",
  // Account / Contact
  "Account.View", "Account.Create", "Account.Edit", "Account.Delete", "Account.ViewAll", "Account.ModifyAll",
  "Contact.View", "Contact.Create", "Contact.Edit", "Contact.Delete",
  // Debt / Settlement domain
  "Debt.View", "Debt.Create", "Debt.Edit", "Debt.Delete",
  "Settlement.View", "Settlement.Create", "Settlement.Edit", "Settlement.Approve",
  "Offer.View", "Offer.Create", "Offer.Edit",
  "ProgramPlan.View", "ProgramPlan.Create", "ProgramPlan.Edit", "ProgramPlan.Change",
  "Payment.View", "Payment.Process", "Payment.Refund",
  "Draft.View", "Draft.Retry", "Draft.Cancel",
  "Fee.View", "Fee.Charge", "Fee.Waive",
  // Case
  "Case.View", "Case.Create", "Case.Edit", "Case.Close", "Case.Escalate", "Case.Approve",
  // Activity
  "Task.View", "Task.Create", "Task.Edit", "Task.Delete",
  "Event.View", "Event.Create", "Event.Edit", "Event.Delete",
  "Call.View", "Call.Log", "Call.ListenRecording",
  // Communications
  "Email.Send", "Email.MassSend", "SMS.Send",
  // Reports
  "Reports.View", "Reports.Create", "Reports.Edit", "Reports.Export",
  "Dashboards.View", "Dashboards.Create",
  // Admin
  "User.View", "User.Create", "User.Edit", "User.Deactivate",
  "Permission.Manage", "Role.Manage", "Queue.Manage",
  "Audit.View", "AppLog.View", "AsyncOp.View",
  "Integration.Manage",
  // Bypass / power perms
  "Bypass.LeadValidation", "Bypass.Validation", "Modify.AllData",
] as const;

export type PermissionKey = typeof PERMISSION_CATALOG[number];

export function isPermissionKey(key: string): key is PermissionKey {
  return (PERMISSION_CATALOG as readonly string[]).includes(key);
}

/**
 * Pure resolver: given the raw set of permission keys a user has, check one.
 * Wildcards: "Modify.AllData" grants everything; "Entity.ViewAll" implies "Entity.View".
 */
export function hasPermission(grantedKeys: Iterable<string>, required: string): boolean {
  const set = new Set(grantedKeys);
  if (set.has("Modify.AllData")) return true;
  if (set.has(required)) return true;

  // ViewAll implies View; ModifyAll implies Edit/View/Delete on the same entity
  const [entity, action] = required.split(".");
  if (!entity || !action) return false;

  if (action === "View" && set.has(`${entity}.ViewAll`)) return true;
  if ((action === "View" || action === "Edit" || action === "Delete") && set.has(`${entity}.ModifyAll`)) return true;

  return false;
}

/**
 * Load a user's full set of effective permission keys from the DB.
 * Walks: Profile → ProfilePermission → PermissionSet → keys
 * Plus:  UserPermissionSet → PermissionSet → keys
 * Plus:  PermissionSetGroup membership expansion.
 */
export async function loadEffectivePermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profileId: true,
      profile: {
        select: {
          permissions: {
            select: {
              permissionSet: {
                select: {
                  permissions: { select: { key: true } },
                  groupItems: {
                    select: {
                      group: {
                        select: {
                          items: {
                            select: {
                              permissionSet: {
                                select: { permissions: { select: { key: true } } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      permissionSets: {
        select: {
          permissionSet: {
            select: {
              permissions: { select: { key: true } },
              groupItems: {
                select: {
                  group: {
                    select: {
                      items: {
                        select: {
                          permissionSet: {
                            select: { permissions: { select: { key: true } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const keys = new Set<string>();
  if (!user) return keys;

  const collectFromPermSet = (ps: { permissions: { key: string }[]; groupItems: { group: { items: { permissionSet: { permissions: { key: string }[] } }[] } }[] }) => {
    for (const p of ps.permissions) keys.add(p.key);
    for (const gi of ps.groupItems) {
      for (const sibling of gi.group.items) {
        for (const p of sibling.permissionSet.permissions) keys.add(p.key);
      }
    }
  };

  for (const link of user.profile?.permissions || []) collectFromPermSet(link.permissionSet);
  for (const link of user.permissionSets || []) collectFromPermSet(link.permissionSet);

  return keys;
}

export class PermissionDeniedError extends Error {
  constructor(public required: string) {
    super(`Permission denied: ${required}`);
    this.name = "PermissionDeniedError";
  }
}

export function requirePermission(grantedKeys: Iterable<string>, required: string): void {
  if (!hasPermission(grantedKeys, required)) throw new PermissionDeniedError(required);
}

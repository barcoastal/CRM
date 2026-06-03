# Salesforce Export

Pulled via SFDX CLI on 2026-06-04 from `cdcrm.my.salesforce.com`
(org ID `00D8Y000001ZRTZUA4`).

## Layout

- `sfdx-raw/` — direct output of `sf project retrieve start` with metadata types:
  - `classes/` — 706 Apex classes (`.cls`)
  - `triggers/` — 29 Apex triggers (`.trigger`)
  - `flows/` — record-triggered, screen, and scheduled Flows
  - `objects/` — custom objects, fields, validation rules
  - `layouts/` — page layouts
  - `permissionsets/`, `profiles/`, `roles/`, `groups/` — access model
  - `lwc/`, `aura/` — UI components
  - `globalValueSets/` — picklist value sets
  - `applications/`, `flexipages/`, `tabs/`, `staticresources/`

## Key files for our CRM

- **Payment Calculator math**: `classes/PaymentCalculator.cls`,
  `classes/PaymentCalculatorElements.cls`,
  `classes/PaymentCalculatorSettings.cls`,
  `classes/LeadPaymentCalcController.cls`.
  Port lives at `src/lib/payment-schedule.ts`.

## Refresh

```bash
cd /tmp/sf-extract/extract
sf project retrieve start --metadata ApexClass --metadata ApexTrigger \
  --metadata Flow --metadata WorkflowRule --metadata ValidationRule \
  --metadata Layout --metadata GlobalValueSet --metadata PermissionSet \
  --metadata Profile --metadata EmailTemplate --metadata CustomObject \
  --metadata Role --metadata Group --target-org coastal
cp -R force-app/main/default/* ~/debt-settlement-app/docs/sf-export/sfdx-raw/
```

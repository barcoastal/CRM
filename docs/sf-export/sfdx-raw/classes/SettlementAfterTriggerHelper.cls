public inherited sharing class SettlementAfterTriggerHelper {
    
    public static void calculatePaymentSummaries() {
        Set<Id> accountIds = new Set<Id>();
        for (Settlement__c settlementRecord : (List<Settlement__c>)Trigger.new) {
            if (eligibleForCalculatingPaymentSummaries(settlementRecord)) {
                accountIds.add(settlementRecord.Client_Account__c);
            }
        }
        if (!accountIds.isEmpty()) {
            PaymentSummaryService.createPaymentSummaries(accountIds, new Set<String> {PaymentSumaryUtil.PAYMENT_TYPE_SETTLEMENT});
        }
    }

    private static Boolean eligibleForCalculatingPaymentSummaries(Settlement__c settlementRecord) {
        Boolean isEligible = false;
        if (Trigger.isInsert) {
            if (settlementRecord.Client_Account__c != null) {
                isEligible = true;
            }
        } else if (Trigger.isUpdate) {
            Settlement__c oldSettlement = (Settlement__c)Trigger.oldMap.get(settlementRecord.Id);
            if (settlementRecord.Client_Account__c != null 
                && (settlementRecord.AmountToCreditor__c != oldSettlement.AmountToCreditor__c
                    || settlementRecord.Client_Account__c != oldSettlement.Client_Account__c
                )
            )
            {
                isEligible = true;
            }
        }
        return isEligible;
    }
}
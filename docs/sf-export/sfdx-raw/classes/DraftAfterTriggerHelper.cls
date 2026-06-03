public inherited sharing class DraftAfterTriggerHelper {
    
    public static void calculatePaymentSummaries() {
        Set<Id> accountIds = new Set<Id>();
        if(Trigger.isDelete) {
            for (Draft__c draftRecord : (List<Draft__c>)Trigger.old) {
                if(draftRecord.Account__c != null){
                   accountIds.add(draftRecord.Account__c);
                }
            }
        } else {
            for (Draft__c draftRecord : (List<Draft__c>)Trigger.new) {
                if (eligibleForCalculatingPaymentSummaries(draftRecord)) {
                    accountIds.add(draftRecord.Account__c);
                }
            }
        }
        if (!accountIds.isEmpty() && accountIds.size() > 0) {
            PaymentSummaryService.createPaymentSummaries(accountIds, new Set<String> {PaymentSumaryUtil.PAYMENT_TYPE_DRAFT, PaymentSumaryUtil.PAYMENT_TYPE_ESCROW_AMOUNT});
        }
    }

    private static Boolean eligibleForCalculatingPaymentSummaries(Draft__c draftRecord) {
        Boolean isEligible = false;
        if (Trigger.isInsert) {
            if (draftRecord.Account__c != null) {
                isEligible = true;
            }
        } else if (Trigger.isUpdate) {
            Draft__c oldDraft = (Draft__c)Trigger.oldMap.get(draftRecord.Id);
            if (draftRecord.Account__c != null 
            && (draftRecord.Draft_Amount__c != oldDraft.Draft_Amount__c
            || draftRecord.Draft_Total_Amount__c != oldDraft.Draft_Total_Amount__c || draftRecord.Draft_Status__c != oldDraft.Draft_Status__c)
                ) {
                isEligible = true;
            }
        }
        return isEligible;
    }
}
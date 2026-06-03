public inherited sharing class FeeAfterTriggerHelper {
    
    public static void calculatePaymentSummaries() {
        Set<Id> accountIdsForDraftsFees = new Set<Id>();
        Set<Id> accountIdsForSettlementFees = new Set<Id>();
        Set<String> paymentTypes = new Set<String>();
        FeeUtil.fetchRecordTypeDevNamesByIds();
        if(Trigger.isDelete) {
            for (Fee__c feeRecord : (List<Fee__c>)Trigger.old) {
                if(feeRecord.Account__c != null){
                    System.debug('delete fee account ' + feeRecord.Account__c);
                    if (FeeUtil.RT_ID_FEE_TYPE_MAP.containsKey(feeRecord.RecordTypeId)) {
                        accountIdsForDraftsFees.add(feeRecord.Account__c);
                        String feeType = FeeUtil.RT_ID_FEE_TYPE_MAP.get(feeRecord.RecordTypeId);
                        if (feeType != FeeUtil.RT_OFFERED_PROGRAM_FEE_SETTLEMENTS) {
                            paymentTypes.add(PaymentSumaryUtil.DRAFT_FEE_RT_PAYMENT_TYPE_MAP.get(feeType));
                        }
                    }
                }
            }
        } else {
            for (Fee__c feeRecord : (List<Fee__c>)Trigger.new) {
                System.debug('feerecord elgi '  + FeeUtil.RT_ID_FEE_TYPE_MAP.get(feeRecord.RecordTypeId) +' amount '+feeRecord.Fee_Amount__c  + ' iselgi ' +  eligibleForCalculatingDraftFeeSummaries(feeRecord));
                if (eligibleForCalculatingDraftFeeSummaries(feeRecord)) {
                    if (FeeUtil.RT_ID_FEE_TYPE_MAP.containsKey(feeRecord.RecordTypeId)) {
                        accountIdsForDraftsFees.add(feeRecord.Account__c);
                        String feeType = FeeUtil.RT_ID_FEE_TYPE_MAP.get(feeRecord.RecordTypeId);
                        if (feeType != FeeUtil.RT_OFFERED_PROGRAM_FEE_SETTLEMENTS) {
                            paymentTypes.add(PaymentSumaryUtil.DRAFT_FEE_RT_PAYMENT_TYPE_MAP.get(feeType));
                        }
                    }
                } else if (eligibleForCalculatingSettlementFeeSummaries(feeRecord)) {
                    if (FeeUtil.RT_ID_FEE_TYPE_MAP.containsKey(feeRecord.RecordTypeId)) {
                        accountIdsForSettlementFees.add(feeRecord.Account__c);
                        String feeType = FeeUtil.RT_ID_FEE_TYPE_MAP.get(feeRecord.RecordTypeId);
                        if (feeType != FeeUtil.RT_OFFERED_PROGRAM_FEE_SETTLEMENTS) {
                            paymentTypes.add(PaymentSumaryUtil.SETTLEMENT_FEE_RT_PAYMENT_TYPE_MAP.get(feeType));
                        }
                    }
                }
            }
        }
        if (!accountIdsForDraftsFees.isEmpty()) {
            PaymentSummaryService.createPaymentSummaries(accountIdsForDraftsFees, paymentTypes);
        }
        if (!accountIdsForSettlementFees.isEmpty()) {
            PaymentSummaryService.createPaymentSummaries(accountIdsForSettlementFees, paymentTypes);
        }
    }

    private static Boolean eligibleForCalculatingDraftFeeSummaries(Fee__c feeRecord) {
        Boolean isEligible = false;
        if (Trigger.isInsert) {
            if (feeRecord.Account__c != null && feeRecord.Draft__c != null) {
                isEligible = true;
            }
        } else if (Trigger.isUpdate) {
            Fee__c oldFeeRecord = (Fee__c)Trigger.oldMap.get(feeRecord.Id);
            if (feeRecord.Account__c != null && feeRecord.Draft__c != null
            && (feeRecord.Fee_Amount__c != oldFeeRecord.Fee_Amount__c || feeRecord.Fee_Status__c != oldFeeRecord.Fee_Status__c )
              )
            {
                isEligible = true;
            }
        }
        return isEligible;
    }

    private static Boolean eligibleForCalculatingSettlementFeeSummaries(Fee__c feeRecord) {
        Boolean isEligible = false;
        if (Trigger.isInsert) {
            if (feeRecord.Account__c != null && feeRecord.Settlement__c != null) {
                isEligible = true;
            }
        } else if (Trigger.isUpdate) {
            Fee__c oldFeeRecord = (Fee__c)Trigger.oldMap.get(feeRecord.Id);
            if (feeRecord.Account__c != null && feeRecord.Settlement__c != null
                && feeRecord.Fee_Amount__c != oldFeeRecord.Fee_Amount__c)
            {
                isEligible = true;
            }
        }
        return isEligible;
    }
}
public without sharing class SettlementTriggerHandler extends TriggerHandler {

    public override void beforeInsert() {
        validationOnInsert();
        populateSyncPending();
    }

    public override void beforeUpdate() {
        validationOnUpdate();
        populateSyncPending();
    }

    public override void afterInsert() {
     //   SettlementAfterTriggerHelper.calculatePaymentSummaries();
    }

    public override void afterUpdate() {
     //   SettlementAfterTriggerHelper.calculatePaymentSummaries();
    }

    private static void validationOnInsert() {
        for (Settlement__c settlementRecord : (List<Settlement__c>)Trigger.new) {
            if (settlementRecord.Settlement_Status__c == 'Cancelled') {
                settlementRecord.addError('Settlement can not be created with cancelled status.');
            }  else if (settlementRecord.Settlement_Status__c == 'Failed') {
                settlementRecord.addError('Settlement can not be created with failed status.');
            } else if (settlementRecord.Settlement_Status__c == 'Completed') {
                settlementRecord.addError('Settlement can not be created with completed status.');
            }
        }
    }

    private static void validationOnUpdate() {
        for (Settlement__c settlementRecord : (List<Settlement__c>)Trigger.new) {
            Settlement__c oldSettlementRecord = (Settlement__c)Trigger.oldMap.get(settlementRecord.Id);
            if (settlementRecord.Settlement_Status__c != oldSettlementRecord.Settlement_Status__c) {
                if (oldSettlementRecord.Settlement_Status__c == 'Cancelled') {
                    settlementRecord.addError('Settlement status should not be moved from cancelled.');
                } else if (oldSettlementRecord.Settlement_Status__c == 'Failed') {
                    settlementRecord.addError('Settlement status should not be moved from failed.');
                } else if (oldSettlementRecord.Settlement_Status__c == 'Completed') {
                    settlementRecord.addError('Settlement status should not be moved from completed.');
                }
            }
        }
    }

    //Populating the Sync Status fields if the payment processor integration related fields are updated
    private static void populateSyncPending() {
        for (Settlement__c settlementRecord : (List<Settlement__c>)Trigger.new) {
            if (Trigger.isInsert) {
                settlementRecord.Sync_Status__c = 'Sync Pending';
            } else if (Trigger.isUpdate) {
                Settlement__c oldSettlementRecord = (Settlement__c)Trigger.oldMap.get(settlementRecord.Id);
                for (Schema.SObjectField sObjField : SettlementWrapper.settlementFields) {
                    if (settlementRecord.get(sObjField) != oldSettlementRecord.get(sObjField)) {
                        settlementRecord.Sync_Status__c = 'Sync Pending';
                        break;
                    }
                }
                if (settlementRecord.Settlement_Status__c != oldSettlementRecord.Settlement_Status__c && (settlementRecord.Settlement_Status__c == SettlementUtil.STATUS_CANCELLED)) {
                    settlementRecord.Sync_Status__c = 'Sync Pending';
                }
            }
        }
    }
}
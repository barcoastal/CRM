public without sharing class OfferHandler extends TriggerHandler {
    
    public override void beforeInsert() {
        validationOnInsert();
    }

    public override void beforeUpdate() {
        validationOnUpdate();
    }

    public override void afterUpdate() {
        cancelRelatedSettlements();
    } 

    private static void validationOnInsert() {
        for (Offer__c offerRecord : (List<Offer__c>)Trigger.new) {
            if (offerRecord.Offer_Status__c == 'Cancelled') {
                offerRecord.addError('Offer can not be created with cancelled status.');
            }  
        }
    }

    private static void validationOnUpdate() {
        for (Offer__c offerRecord : (List<Offer__c>)Trigger.new) {
            Offer__c oldOfferRecord = (Offer__c)Trigger.oldMap.get(offerRecord.Id);
            if (offerRecord.Offer_Status__c != oldOfferRecord.Offer_Status__c) {
                if (oldOfferRecord.Offer_Status__c == 'Cancelled') {
                    offerRecord.addError('Offer status should not be moved from cancelled.');
                }
            }
        }
    }

    private static void cancelRelatedSettlements() {
        List<Settlement__c> settlementsToUpdate = new List<Settlement__c>();
        Set<Id> offerIds = new Set<Id>();
        for (Offer__c offerRecord : (List<Offer__c>)Trigger.new) {
            Offer__c oldOfferRecord = (Offer__c)Trigger.oldMap.get(offerRecord.Id);
            if (offerRecord.Offer_Status__c != oldOfferRecord.Offer_Status__c) {
                if (offerRecord.Offer_Status__c == 'Cancelled') {
                    offerIds.add(offerRecord.Id);
                }
            }
        }
        if (!offerIds.isEmpty()) {
            for (Settlement__c settlementRecord : [SELECT Id FROM Settlement__c WHERE Offer__c IN :offerIds 
                AND Settlement_Status__c NOT IN ('Cancelled', 'Failed', 'Completed')]) 
            {
                Settlement__c settlementToUpdate = new Settlement__c();
                settlementToUpdate.Id = settlementRecord.Id;
                settlementToUpdate.Settlement_Status__c = 'Cancelled';
                settlementsToUpdate.add(settlementToUpdate);
            }
            update settlementsToUpdate;
        }
    }
}
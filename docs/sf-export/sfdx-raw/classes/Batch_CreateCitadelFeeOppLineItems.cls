public without sharing class Batch_CreateCitadelFeeOppLineItems implements Database.Batchable<SObject> {
    String query = 'Select id from Opportunity where Id NOT IN (Select OpportunityId FROM OpportunitylineItem where Product2.ProductCode = \'CitadelFee\')';
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext bc, List<Opportunity> scope) {
        List<OpportunityLineItem> opplineItemsToInsert = new List<OpportunityLineItem>();
        for (Opportunity oppRecord : scope) {
            OpportunityLineItem opplineItem = new OpportunityLineItem();
            opplineItem.OpportunityId = oppRecord.Id;
            opplineItem.Product2Id = '01tVO000006DRLWYA4';
            opplineItem.PricebookEntryId = '01uVO000000XLSHYA4';
            opplineItem.Quantity = 1;
            opplineItem.TotalPrice = 145;
            opplineItemsToInsert.add(opplineItem);
        }
        insert opplineItemsToInsert;
    }

    public void finish(Database.BatchableContext bc) {
    }
}
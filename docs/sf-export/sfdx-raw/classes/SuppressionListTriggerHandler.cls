public class SuppressionListTriggerHandler {
    public static void handleAfterInsert(List<Suppression_List__e> newEvents) {
        for (Suppression_List__e eventRecord : newEvents) {
            if (eventRecord.ParentId__c != null && eventRecord.ContentDocumentId__c != null) {
                SuppressionListBatch batch = new SuppressionListBatch(
                    eventRecord.ParentId__c,
                    eventRecord.ContentDocumentId__c
                );
                Database.executeBatch(batch);
            }
        }
    }
}
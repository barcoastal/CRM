public without sharing class AsyncOperationHandler extends TriggerHandler {

    public override void beforeInsert() {
        assignAsyncOperationToParent();
    }

    private static void assignAsyncOperationToParent() {
        for (Async_Operation__c asyncOperation : (List<Async_Operation__c>)Trigger.new) {
            if (asyncOperation.Record_Id__c != null) {
                if (asyncOperation.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Lead'))) {
                    asyncOperation.Lead__c = asyncOperation.Record_Id__c;
                } else if (asyncOperation.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Individual'))) {
                    asyncOperation.Individual__c = asyncOperation.Record_Id__c;
                } else if (asyncOperation.Record_Id__c.startsWith(ApexUtil.getKeyPrefix('Opportunity'))) {
                    asyncOperation.Opportunity__c = asyncOperation.Record_Id__c;
                }
            }
        }   
    }
}
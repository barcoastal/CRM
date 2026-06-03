public inherited sharing class AsyncOperationData {
     
    public static List<Async_Operation__c> getAsyncOpWithUniqueId(Set<String> uniqueIdsForQuery){
        return [SELECT Unique_Id__c FROM Async_Operation__c WHERE Unique_Id__c IN :uniqueIdsForQuery];
    }
}
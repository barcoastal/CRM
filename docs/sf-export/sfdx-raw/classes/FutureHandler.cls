public without sharing class FutureHandler {
    
    @future
    public static void deduplicateLeads(Set<Id> leadIds) {
        DeDuplicateLeads.deDuplicateLeads(leadIds);
    }

    //Future calls for Async Operations
    @future(callout=true)
    public static void processAsyncOperations(Id asyncOperationId) {
        try {
            List<Async_Operation__c> asyncOperationsList = [SELECT Id, Record_Id__c, Async_Type__c, Status__c, Operation__c, Lead__c, Individual__c
                FROM Async_Operation__c WHERE Id = :asyncOperationId AND Status__c != 'Cancelled'
            ];
            AsyncOperationService.initiateAsyncOperations(asyncOperationsList);
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null,'FutureHandler-processAsyncOperations', 'High');
        }
    }
    @future
    public static void initiatePaymentProcessorSync(Id accId) {
        SyncToPaymentProcessorController.initiateSync(accId);
    }
    
    @future
    public static void webLeadDeDuplication(Set<Id> leadIds) {
        LeadDeDuplicationHandler.deduplicateLeads(leadIds);
    }
    
    @future(Callout=true)
     public static void makeCreateBankAccountSync(String accId, String oppId) {
        ProcessorCreateAPI.createBankAccountAPI(accId, oppId);
    }
    
    @future(Callout=true)
     public static void makeUpdateClientSync(String accId, String oppId) {
        ProcessorCreateAPI.updateClient(accId, oppId);
    } 
}
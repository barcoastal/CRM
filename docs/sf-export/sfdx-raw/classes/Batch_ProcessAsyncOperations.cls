//Batch to process async operations
public without sharing class Batch_ProcessAsyncOperations implements Database.Batchable<SObject>, Database.AllowsCallouts, Schedulable {

    private static final String STATUS_PENDING = AsyncOperationUtil.STATUS_PENDING;
    private static final String SCOPE_NAME = 'Batch_ProcessAsyncOperations';
    public String queryString;
    public Integer batchSize = 5;
    
    
    public Batch_ProcessAsyncOperations() {
        this.queryString = 'SELECT Id, Record_Id__c, Async_Type__c, Status__c, Operation__c, Lead__c, Individual__c FROM Async_Operation__c WHERE Status__c = :STATUS_PENDING ORDER BY Operation__c';
    }

    public Batch_ProcessAsyncOperations(String queryString) {
        this.queryString = queryString;
    }

    public Batch_ProcessAsyncOperations(String queryString, Integer batchSize) {
        this.queryString = queryString;
        if (batchSize != null && batchSize > 0) {
            this.batchSize = batchSize;
        }
    }
    
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(queryString);
    }
    
    public void execute(Database.BatchableContext bc, List<Async_Operation__c> scope) {
        try {
            AsyncOperationService.initiateAsyncOperations(scope);
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null, SCOPE_NAME, ApplicationLogger.SEVERITY_HIGH);
        }
    }

    public void finish(Database.BatchableContext bc) {
    }

    public void execute(SchedulableContext sc) {
        Batch_ProcessAsyncOperations batch = new Batch_ProcessAsyncOperations(this.queryString);
        Database.executeBatch(batch, this.batchSize);
    }
}
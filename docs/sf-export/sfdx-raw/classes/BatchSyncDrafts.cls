public with sharing class BatchSyncDrafts implements Database.Batchable<SObject>, Database.AllowsCallouts {

    public Date draftDtate = System.today().addDays(1);
    public Set<String> draftStatusesToSync = new Set<String> {'Pending', 'Failed'};

    public BatchSyncDrafts() {
    }
    
    public BatchSyncDrafts(Date draftDate) {
        this.draftDtate = draftDate;
    }

    public Database.QueryLocator start(Database.BatchableContext BC) {
        String query = getQuery();
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext BC, List<SObject> scope) {
        try {
            List<Draft__c> draftsToDML = new List<Draft__c>();
            for (Draft__c draftRecord : (List<Draft__c>)scope) {
                Draft__c draftWithoutSOQLMemory = (Draft__c)ApexUtil.removeSOQLMemory(draftRecord);
                DraftWrapper draftWrap = new DraftWrapper(draftWithoutSOQLMemory);
                ProcessorWrapper.CreateDraftRequest draftRequest = new ProcessorWrapper.CreateDraftRequest();
                draftRequest.draftWrap = draftWrap;
                PaymentProcessor paymentProcInstance = ProcessorAPI.getInstance(draftRecord.Program_Plan__r.Payment_Processor__r.Processor_Type__c);
                ProcessorWrapper.API_Response apiResponse = paymentProcInstance.createDraft(draftRequest);
                if (apiResponse != null) {
                    Draft__c draftToDML = new Draft__c();
                    draftToDML.Id = draftRecord.Id;
                    if (apiResponse.isSuccess == false) {
                        draftToDML.Sync_Status__c = 'Failed';
                    } else if (apiResponse.isSuccess == true) {
                        draftToDML.External_SAS_Id__c = apiResponse.externalId;
                        draftToDML.Sync_Status__c = 'Completed';
                        draftToDML.Draft_Status__c = 'Scheduled';
                    }
                    draftsToDML.add(draftToDML);
                }
            }
            update draftsToDML;
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null);
        }
    }

    public void finish(Database.BatchableContext BC) {
    }

    private String getQuery() {
        return 'SELECT Id, Program_Plan__r.Client__c, Draft_Date__c,' 
        + ' Program_Plan__r.Payment_Processor__r.Processor_Type__c, Draft_Total_Amount__c'
        + ' FROM Draft__c WHERE Draft_Date__c = :draftDtate ' 
        + ' AND Sync_Status__c IN :draftStatusesToSync AND Retainer_SetupFee_Draft__c = false ' 
        + ' AND Program_Plan__c != null';
    }
}
/*----------------------------------------------------------------
    Author: Vinitha
    Description: A batch to process staging records. It updates or inserts Draft records 
                 and populates fee fields directly on the Draft from child payment data.
    Test Class: 
--------------------------------------------------------------------*/
public without sharing class Batch_RAM_ProcessDraftUpdates implements Database.Batchable<SObject> {
    
    public Id externalApiIdVar;
    public String queryString;

    public Batch_RAM_ProcessDraftUpdates(Id externalApiId) {
        this.externalApiIdVar = externalApiId;
        this.queryString = 'SELECT Id, Client_SF_Id__c, Payment_Amount__c, Payment_Date__c, Payment_External_Id__c, ' +
                           'Payment_SF_Id__c, Payment_Status__c, Is_Child__c , Client_External_Id__c ' +
                           'FROM External_Data__c WHERE External_API_Details__c =:externalApiIdVar';
    }
    
    public Batch_RAM_ProcessDraftUpdates(Id externalApiId,String query) {
        this.externalApiIdVar = externalApiId;
        this.queryString = query;
    }

    // Start method now queries all necessary fields, including the Is_Child__c flag
    public Database.QueryLocator start(Database.BatchableContext bc){
        return Database.getQueryLocator(queryString);
    }

    public void execute(Database.BatchableContext bc, List<External_Data__c> scope) {
        Set<String> draftExternalIds = new Set<String>();
        Map<String, Id> draftMap = new Map<String, Id>();
        List<Draft__c> updateDrafts = new List<Draft__c>();
        Set<Id> draftIds = new Set<Id>();
        List<External_Data__c> updateExternalData = new List<External_Data__c>();
        try {
            Map<String, String> statusMapping = getPaymentStatusMap();
            for(External_Data__c externalDataRec: scope){
                draftExternalIds.add(externalDataRec.Payment_External_Id__c);
            } 
            for(Draft__c draftRec: [SELECT Id,Draft_Status__c,External_RAM_Id__c FROM Draft__c WHERE External_RAM_Id__c =:draftExternalIds]){
                If(!draftMap.containsKey(draftRec.External_RAM_Id__c)){
                    draftMap.put(draftRec.External_RAM_Id__c, draftRec.Id);
                }
                
            }
            for(External_Data__c externalDataRec: scope){
                if(draftMap.containsKey(externalDataRec.Payment_External_Id__c) && !draftIds.contains(draftMap.get(externalDataRec.Payment_External_Id__c))){                    
                    if (statusMapping.containsKey(externalDataRec.Payment_Status__c)) {
                        Draft__c updateDraft = new Draft__c();
                        updateDraft.Id = draftMap.get(externalDataRec.Payment_External_Id__c);
                        updateDraft.Draft_Status__c = statusMapping.get(externalDataRec.Payment_Status__c);
                        draftIds.add(draftMap.get(externalDataRec.Payment_External_Id__c));
                        externalDataRec.Processing_Status__c = 'Success';
                        updateDrafts.add(updateDraft);
                    }else{
                        externalDataRec.Processing_Status__c = 'Skipped';
                        externalDataRec.Error_Message__c = 'Draft status not available in salesforce.';
                    }
                }else{
                    externalDataRec.Processing_Status__c = 'Failed';
                    externalDataRec.Error_Message__c = 'This draft is not available in salesforce.';
                }
                updateExternalData.add(externalDataRec);
            }
            AccountHandler.skipValidation = true;
            for (Database.SaveResult urDraft : Database.update(updateDrafts, false)) {
                if (!urDraft.isSuccess()) {           
                    for (Database.Error err : urDraft.getErrors()) {
                        ApplicationLogger.logDMLException(
                            'Draft fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            urDraft.getId(), err.getStatuscode() + ': ' + err.getMessage(), true
                        );
                    }
                }
            }
            AccountHandler.skipValidation = false;  
            
            for (Database.SaveResult updateExternal : Database.update(updateExternalData, false)) {
                if (!updateExternal.isSuccess()) {           
                    for (Database.Error err : updateExternal.getErrors()) {
                        ApplicationLogger.logDMLException(
                            'Exteranla Data fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            updateExternal.getId(), err.getStatuscode() + ': ' + err.getMessage(), true
                        );
                    }
                }
            }       
        } catch (Exception exp) {
            ApplicationLogger.logException(exp, this.externalApiIdVar);
        } finally {
             ApplicationLogger.insertStoredLogs();
        }
    }
    
    private Map<String, String> getPaymentStatusMap() {
        Map<String, String> paymentStatusMapping = new Map<String, String>();
        for(RAM_Payment_Status_Mapping__mdt paymentMap :[SELECT SF_Draft_Status__c,RAM_Draft_Status__c FROM RAM_Payment_Status_Mapping__mdt WHERE SF_Draft_Status__c != null AND RAM_Draft_Status__c != null]){
            paymentStatusMapping.put(paymentMap.RAM_Draft_Status__c, paymentMap.SF_Draft_Status__c);
        }
        return paymentStatusMapping;
    }
    
    public void finish(Database.BatchableContext bc) { 
        External_API_Details__c externalApi = new External_API_Details__c(
            Id = this.externalApiIdVar,
            API_Status__c = 'Completed'
        );
        Database.SaveResult srData = Database.update(externalApi , false);
        if (!srData.isSuccess()) {
            for (Database.Error err : srData.getErrors()) {
                ApplicationLogger.logDMLException('External API Details fields that affected this error : ' + String.join(err.getFields(), ', '), srData.getId(), err.getStatuscode() + ': ' + err.getMessage(),true);
            }
        }
        ApplicationLogger.insertStoredLogs();
    }
}
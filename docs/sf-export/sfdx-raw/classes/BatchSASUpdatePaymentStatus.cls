/**
* @Description: Batch class to update the payment status in the Draft record from the SAS getPaymentStatus Bulk API response.
*/
public inherited sharing class BatchSASUpdatePaymentStatus  implements Database.Batchable<sObject>{
    
    public Id calloutDataId;
    
    //Constructor to assign the Callout Data Id using the Id from the predecessor Batch
    public BatchSASUpdatePaymentStatus(Id dataId) {
        this.calloutDataId = dataId;
    }
    
    //Start method to query the Callout Data Item record related the Callout Data created in the predecessor batch
    public Database.QueryLocator start(Database.BatchableContext BC){
        
        String query;
        
        if (String.isNotBlank(this.calloutDataId)) {
            query = 'SELECT '+ SASUtility.getCDIfieldsToQuery('GetPaymentStatusBulk') 
                + ' FROM Callout_Data_Item__c WHERE Callout_Data__c = \''+ this.calloutDataId + '\'';
        } else {
            throw new CustomException('Callout Data Id is required to execute the batch');
        }
        return Database.getQueryLocator(query);
    }
    
    //Execute method to update the Draft records with payment status from the Callout Data Item
    public void execute(Database.BatchableContext BC, List<sObject> scope){
        
        Map<Id, Draft__c> draftMap = new Map<Id, Draft__c>();
        List<Application_Log__c> applicationLogs = new List<Application_Log__c>(); 
        Map<String, Callout_Data_Item__c> draftSASIdWithCDIMap = new Map<String, Callout_Data_Item__c>();
        
        try {
            
            for(sObject objectInstance : scope){
                Callout_Data_Item__c dataItem = (Callout_Data_Item__c)objectInstance;
                if (String.isNotBlank(dataItem.External_Id__c)) {
                    draftSASIdWithCDIMap.put(String.valueOf(dataItem.External_Id__c), dataItem);
                }
            }
            
            if (draftSASIdWithCDIMap != null && !draftSASIdWithCDIMap.values().isEmpty()) {
                
                //Set to store the external id from SAS. ie., SAS Payment record id
                Set<String> draftSASIdSet = new Set<String>(draftSASIdWithCDIMap.keySet());
                //Assign all draft records retrieved using the draftSASIdSet to the draft map
                draftMap.putAll(DraftData.queryDraftBySASIds(draftSASIdSet));
                //SAS payment status with salesforce draft status mapping
                Map<String, String> statusMapping = new Map<String, String>{
                    'Successful'=>'Scheduled',
                     'Failed'=>'NSF'
                };
                //Update the payment status in the draft records.
                for (Draft__c draftInstance : draftMap.values()) {
                	draftMap.get(draftInstance.Id).put('Draft_Status__c', statusMapping.get(draftSASIdWithCDIMap.get(draftInstance.External_SAS_Id__c).Payment_Status__c));
                	draftSASIdSet.remove(draftInstance.External_SAS_Id__c);
         		}
                //create application log instance for the draft records doesn't exists in salesforce.
                if (draftSASIdSet != null && !draftSASIdSet.isEmpty()) {
                    for (String draftSASId : draftSASIdSet) {
                        Application_Log__c log = new Application_Log__c(
                            Exception_Message__c = draftSASId + ' - Draft does not exists', Log_Type__c = 'Error', 
                            Callout_Data_Item__c = draftSASIdWithCDIMap.get(draftSASId).Id
                        );
                        applicationLogs.add(log);
                    }
                }
                Schema.SObjectField externalSASId = Schema.getGlobalDescribe().get('Draft__c').getDescribe().fields.getMap().get('External_SAS_Id__c');
                //Update all the draft records with the payment status from SAS based on the external SAS Id.
                for (Database.UpsertResult urDraft : Database.upsert(draftMap.values(), externalSASId, false)) {
                    if (!urDraft.isSuccess()) {           
                        for (Database.Error err : urDraft.getErrors()) {
                            ApplicationLogger.logDMLException(
                                'Draft fields that affected this error : ' + String.join(err.getFields(), ', '), 
                                urDraft.getId(), err.getStatuscode() + ': ' + err.getMessage()
                            );
                        }
                    }
                }
                
                //Insert all application log records and join it to callout data item records with no account records in current org (INVALID_CROSS_REFERENCE_KEY).
                for (Database.SaveResult srLog : Database.insert(applicationLogs, false)) {
                    if (!srLog.isSuccess()) {           
                        for (Database.Error err : srLog.getErrors()) {
                            ApplicationLogger.logDMLException(
                                'Application Log fields that affected this error : ' + String.join(err.getFields(), ', '), 
                                srLog.getId(), err.getStatuscode() + ': ' + err.getMessage()
                            );
                        }
                    }
                }
            }      
        } catch(Exception exp) {
            ApplicationLogger.logException(exp, calloutDataId);
        }
    }
    
    public void finish(Database.BatchableContext BC){
    }
}
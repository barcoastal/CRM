/*----------------------------------------------------------------
    Author: Vinitha
    Description: A batch to create External Data object records underneath External API Details.
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Jan-01-2026      Vinitha                 Initial Development                 
--------------------------------------------------------------------*/
public without sharing class Batch_RAM_GetDraftUpdates implements Database.Batchable<GetClientTransactionsWrapper>, Database.AllowsCallouts, Database.Stateful {
    
    public String fromDate;
    public Id externalApiId;
    public Integer batchSize;

    public Batch_RAM_GetDraftUpdates(String fromDate, Integer batchSize) {
        this.fromDate= fromDate;
        if (batchSize != null && batchSize > 0) {
            this.batchSize = batchSize;
        }
    }
    
    //Empty Constructor to assign the time frames to retrieve records for last 24 hours
    public Batch_RAM_GetDraftUpdates() {
        this.fromDate = Datetime.now().addDays(-1).format('yyyy-MM-dd');
    }

    //Start method to create the External API Detail record based on the RAM GetClientTransactionsByUpdateDate response.
    public Iterable<GetClientTransactionsWrapper> start(Database.BatchableContext BC){
        List<GetClientTransactionsWrapper> getClientTransactionWrap = new List<GetClientTransactionsWrapper>();
        try{            
            ProcessorWrapper.API_Response clientTransactionResponse = RAMApi.getGetClientTransactionsByUpdateDate(this.fromDate);
            if(clientTransactionResponse.isSuccess == true && clientTransactionResponse.processData != null){
                getClientTransactionWrap = (List<GetClientTransactionsWrapper>)JSON.deserialize(clientTransactionResponse.processData, List<GetClientTransactionsWrapper>.class); 
                External_API_Details__c externalApi = new External_API_Details__c();
                externalApi.API_Name__c = 'GetClientTransactionsByUpdateDate';
                externalApi.API_Status__c = 'In Progress';                
                Database.SaveResult srData = Database.insert(externalApi);
                if (srData.isSuccess()) {           
                    this.externalApiId = srData.getId();
                } else {
                    for (Database.Error err : srData.getErrors()) {
                        ApplicationLogger.logDMLException(
                            'External API Details fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            srData.getId(), err.getStatuscode() + ': ' + err.getMessage(),true
                        );
                    }
                }           
            }else {
                ApplicationLogger.logDebugInfo(String.isNotBlank(clientTransactionResponse.message) ? clientTransactionResponse.message : 'No Data found.', null);  
            }            
        }catch (Exception exp) {
            ApplicationLogger.logException('Batch_RAM_GetDraftUpdates', null, exp.getMessage());
        }finally {
             ApplicationLogger.insertStoredLogs();
        }
        return getClientTransactionWrap;
    }
    
    public void execute(Database.BatchableContext BC, List<GetClientTransactionsWrapper> scope){
        try{    
            List<External_Data__c> externalDataList = new List<External_Data__c>();
            for(GetClientTransactionsWrapper getClientWrap: scope){
                External_Data__c exData = new External_Data__c(
                    External_API_Details__c = externalApiId,
                    Payment_External_Id__c = getClientWrap.draftExternalId,
                    Payment_Status__c = getClientWrap.Status,
                    Client_External_Id__c = getClientWrap.clientExternalId
                );
                externalDataList.add(exData);
            }
            
            if (!externalDataList.isEmpty()) {
                for (Database.SaveResult srData : Database.insert(externalDataList, false)) {
                    if (!srData.isSuccess()) {           
                        for (Database.Error err : srData.getErrors()) {
                            ApplicationLogger.logDMLException(
                                'External Data fields that affected this error : ' + String.join(err.getFields(), ', '), 
                                srData.getId(), err.getStatuscode() + ': ' + err.getMessage(), true
                            );
                        }
                    }
                }
            }
        }catch (Exception exp) {
            ApplicationLogger.logException('Batch_RAM_GetDraftUpdates', null, exp.getMessage());
        }finally {
             ApplicationLogger.insertStoredLogs();
        }
    }
    
    //Finish method to invoke concurrent Batch call to process staging records and update Draft records.
    public void finish(Database.BatchableContext BC){ 
        if (String.isNotBlank(externalApiId)) {
            Database.executeBatch(new Batch_RAM_ProcessDraftUpdates(externalApiId), 50);
        }        
    }

    public class GetClientTransactionsWrapper {
        public String status;
        public String draftExternalId;
        public String clientExternalId;
    }
}
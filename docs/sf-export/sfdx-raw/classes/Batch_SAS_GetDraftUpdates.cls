/*----------------------------------------------------------------
    Author: Vinitha
    Description: A batch to create External Data object records underneath External API Details.
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Mar-05-2024     Vinitha                 Initial Development                 75%
--------------------------------------------------------------------*/
public without sharing class Batch_SAS_GetDraftUpdates implements Database.Batchable<GetDebitScheduleWrapper>, Database.AllowsCallouts, Database.Stateful {
    
    public Datetime startDateTime;
    public Datetime endDateTime;
    public Id externalApiId;
    public Integer pageSize=2000;
    public Integer currentPage= 0;
    public Integer totalPageCount=0;

    //Constructor to assign the time frames from the batch call
    public Batch_SAS_GetDraftUpdates(Datetime startDate, Datetime endDate, Integer currentPage, String externalApiId) {
        this.startDateTime = startDate;
        this.endDateTime = endDate;
        this.currentPage = currentPage;
        this.externalApiId = externalApiId;
    }
    
    //Empty Constructor to assign the time frames to retrieve records for last 24 hourse
    public Batch_SAS_GetDraftUpdates() {
        this.startDateTime = System.now().addHours(-24);
        this.endDateTime = System.now();
        this.currentPage = 0;
    }

    //Start method to create the External API Detail record based on the SAS getDebitSchedule response.
    public Iterable<GetDebitScheduleWrapper> start(Database.BatchableContext BC){        
        
        List<GetDebitScheduleWrapper> getDebitScheduleWrap;
        ProcessorWrapper.API_Response apiResponse = ProcessorAPI.getDebitSchedule('SAS', startDateTime, endDateTime, currentPage, pageSize);
        if (apiResponse != null) {
                    
            if(apiResponse.recordsCount > pagesize){
                totalPageCount = Math.round(apiResponse.recordsCount/pagesize);
                totalPageCount = Math.mod(apiResponse.recordsCount,pagesize) > 0 ? totalPageCount + 1 : totalPageCount;
            } 
            
            if(currentPage == 0) {
                External_API_Details__c externalApi = new External_API_Details__c();
                externalApi.API_Name__c = 'GetUpdatedDebits';
                externalApi.API_Status__c = 'In Progress';                
                Database.SaveResult srData = Database.insert(externalApi);
                if (srData.isSuccess()) {           
                    this.externalApiId = srData.getId();
                } else {
                    for (Database.Error err : srData.getErrors()) {
                        ApplicationLogger.logDMLException(
                            'External API Details fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            srData.getId(), err.getStatuscode() + ': ' + err.getMessage()
                        );
                    }
                }
            }
            if (apiResponse.isSuccess && apiResponse.processData != null && apiResponse.processData != '' && apiResponse.processData != '[]') {
                getDebitScheduleWrap = (List<GetDebitScheduleWrapper>)JSON.deserialize(apiResponse.processData, List<GetDebitScheduleWrapper>.class);
            } else {
                ApplicationLogger.logDebugInfo(String.isNotBlank(apiResponse.message) ? apiResponse.message : 'No Data found.', this.externalApiId);  
            }
        }
        return  getDebitScheduleWrap != null ? getDebitScheduleWrap : new List<GetDebitScheduleWrapper>();
    }
    
    //Execute method to create External Data records based on the data retrieved from SAS getDebitSchedule response.
    public void execute(Database.BatchableContext BC, List<GetDebitScheduleWrapper> scope){
        List<External_Data__c> externalDataList = new List<External_Data__c>();
        for(GetDebitScheduleWrapper getDebitWrap : scope){
            External_Data__c exData = new External_Data__c(
                External_API_Details__c = externalApiId,
                Payment_Amount__c = getDebitWrap.Total,
                Payment_External_Id__c = getDebitWrap.DebitID,
                Payment_Status__c = getDebitWrap.Status,
                Payment_Date__c = getDebitWrap.DebitDate,
                Payment_SF_Id__c = getDebitWrap.DebitRemoteID,
                Client_SF_Id__c = getDebitWrap.RemoteID,
                Client_External_Id__c = getDebitWrap.CustomerID,
                NSF_Reason__c= getDebitWrap.Reason,
       Debit_Date_Cleared__c = getDebitWrap.DateCleared
            );
            externalDataList.add(exData);
                if (String.isNotBlank(getDebitWrap.Payments)) {
                try {
                    List<getPayoutsWrapper> payouts = (List<getPayoutsWrapper>) JSON.deserialize(getDebitWrap.Payments, List<getPayoutsWrapper>.class);
                    for(getPayoutsWrapper payoutWrapper : payouts){
                        External_Data__c childExData = new External_Data__c(
                            External_API_Details__c = externalApiId,
                            Payment_Amount__c = payoutWrapper.amount,
                            Payment_External_Id__c = payoutWrapper.id,
                            Client_SF_Id__c = payoutWrapper.debitschedules_debits_id,
                            Client_External_Id__c = payoutWrapper.payees_id,
                            Is_Child__c = true 
                        );
                        externalDataList.add(childExData);
                    }
                } catch (Exception exp) {
                    ApplicationLogger.logException(exp, this.externalApiId);
                }
            }
        }
        if (!externalDataList.isEmpty()) {
            for (Database.SaveResult srData : Database.insert(externalDataList, false)) {
                if (!srData.isSuccess()) {           
                    for (Database.Error err : srData.getErrors()) {
                        ApplicationLogger.logDMLException(
                            'External Data fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            srData.getId(), err.getStatuscode() + ': ' + err.getMessage()
                        );
                    }
                }
            }
        }
    }
    
    //Finish method to invoke concurrent Batch call to process staging records and update Draft records.
    public void finish(Database.BatchableContext BC){        
        currentPage++;
        if(totalPageCount != 0 && currentPage < totalPageCount){    
            Batch_SAS_GetDraftUpdates instance = new Batch_SAS_GetDraftUpdates();
            Database.executeBatch(new Batch_SAS_GetDraftUpdates(startDateTime, endDateTime, currentPage,externalApiId)); 
        }else if (String.isNotBlank(externalApiId)) {
            Database.executeBatch(new Batch_SAS_ProcessDraftUpdates(externalApiId), 50);
        }        
    }

     /**
     * @Description: Wrapper class to store the Bulk API response from the GetDebitSchedul SAS callout.
     */
    public class GetDebitScheduleWrapper {
        public String PaymentID;
        public String DebitID;
        public String CustomerID;
        public String RemoteID;
        public String DebitScheduleID;
        public String Total;
        public String Status;
        public String DateLastModified;
        public String DebitDate;
        public String DateCleared;
        public String TransactionID;
        public String Reason; 
        public String DebitRemoteID;  
        public String Payments;
    }
    
    public class getPayoutsWrapper {
        public String id;
        public String amount;
        public String reason;
        public String debitschedules_debits_id;
        public String payees_id;
        public String payees_remoteid;
    }
}
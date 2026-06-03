/**
 * @Description: Batch class to make SAS Bulk API callout to retrieve the current total cleared balances.
 * Based on the callout request and response, it also creates the Callout Data record and Callout Data Item records.
 * Finally it invoke the BatchSASUpdateAccountBalance class to update the balance in the Account.
 */
public without sharing class BatchSASGetBalances implements Database.Batchable<GetBalancesWrapper>, Database.AllowsCallouts, Database.Stateful {

    public Id calloutDataId;

    //Start method to create the callout data record based on the SAS getBalances response.
    public Iterable<GetBalancesWrapper> start(Database.BatchableContext BC){

        List<GetBalancesWrapper> getBalanceWrap;
        ProcessorWrapper.API_Response apiResponse = ProcessorAPI.getBalances('SAS');

        if (apiResponse != null) {

            Callout_Data__c calloutData = new Callout_Data__c();
            calloutData.Method_Name__c = 'GetBalances';
            calloutData.Message__c = apiResponse.message;
            calloutData.IsSuccess__c = apiResponse.isSuccess;
            calloutData.Records_Count__c = apiResponse.recordsCount;
            calloutData.Status__c = apiResponse.status;
            calloutData.Status_Code__c = apiResponse.statusCode;

            Database.SaveResult srData = Database.insert(calloutData, false);
            if (srData.isSuccess()) {           
                this.calloutDataId = srData.getId();
            } else {
                for (Database.Error err : srData.getErrors()) {
                    ApplicationLogger.logDMLException(
                        'Callout Data fields that affected this error : ' + String.join(err.getFields(), ', '), 
                        srData.getId(), err.getStatuscode() + ': ' + err.getMessage()
                    );
                }
            }

            if (apiResponse.isSuccess && apiResponse.processData != null && apiResponse.processData != '' && apiResponse.processData != '[]') {
                ApplicationLogger.logDebugInfo('Successfully retrieved data from GetBalances callout', this.calloutDataId);  
                getBalanceWrap = (List<GetBalancesWrapper>)JSON.deserialize(apiResponse.processData, List<GetBalancesWrapper>.class);
            } else {
                ApplicationLogger.logDebugInfo(String.isNotBlank(apiResponse.message) ? apiResponse.message : 'No Data found.', this.calloutDataId);  
            }
        }
        return getBalanceWrap != null ? getBalanceWrap : new List<GetBalancesWrapper>();
    }
    
    //Execute method to create Callout Data Item records based on the data retrieved from SAS getBalances response.
    public void execute(Database.BatchableContext BC, List<GetBalancesWrapper> scope){
        
        List<Callout_Data_Item__c> calloutDataItemList = new List<Callout_Data_Item__c>();
        for(GetBalancesWrapper balWrap : scope){
            Callout_Data_Item__c cDI = new Callout_Data_Item__c(
                Callout_Data__c = calloutDataId, Balance_In__c = balWrap.balance_in, 
                Balance_Out__c = balWrap.balance_out, Current_Balance__c = balWrap.current_balance, 
                Record_Id__c = balWrap.remoteid, External_Id__c = balWrap.id
            );
            calloutDataItemList.add(cDI);
        }
        if (!calloutDataItemList.isEmpty()) {
            for (Database.SaveResult srData : Database.insert(calloutDataItemList, false)) {
                if (!srData.isSuccess()) {           
                    for (Database.Error err : srData.getErrors()) {
                        ApplicationLogger.logDMLException(
                            'Callout Data Item fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            srData.getId(), err.getStatuscode() + ': ' + err.getMessage()
                        );
                    }
                }
            }
        }
    }
    
    //Finish method to invoke concurrent Batch call to update the Balance in Account records.
    public void finish(Database.BatchableContext BC){
        if (String.isNotBlank(calloutDataId)) {
            Database.executeBatch(new BatchSASUpdateAccountBalance(calloutDataId));
        }
    }    
    
    /**
     * @Description: Wrapper class to store the Bulk API response from the GetBalances SAS callout.
     */
    public class GetBalancesWrapper {
        public String id;
        public String remoteid;
        public Decimal balance_in;
        public Decimal balance_out;
        public Decimal current_balance;
    }
}
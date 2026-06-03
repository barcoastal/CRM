//Dedicated class for creating async operation records for Account
public inherited sharing class AccountAfterTriggerAsyncOpHelper {
    
    private static AsyncOperationUtil.ASYNC_TYPE_ENUM asyncType = getAsyncType();

    public static void createAsyncOperationRecords() {
        List<Account> accts = new List<Account>();
        if (Trigger.isAfter) {
            for (Account accInstance : (List<Account>)Trigger.new) {
                if (Trigger.isUpdate) {
                    accts.add(accInstance);
                    //createAsyncOpSetCustomerStatusAPI(accInstance);
                }
            }
        }
        
        Set<Id> accountIds = new Map<Id, Account>(accts).keySet();
        Map<Id, Opportunity> opptMap = OpportunityData.getActiveOpportunitiesByAccountId(accountIds);
        
        for (Account accInstance : (List<Account>)Trigger.new) {
             Account oldAccount = (Account)Trigger.oldMap.get(accInstance.Id);
            Opportunity opp = opptMap.get(accInstance.Id); 
            if(opp != null && accInstance.Completed_Draft_Count__c != null && oldAccount.Completed_Draft_Count__c != accInstance.Completed_Draft_Count__c && (accInstance.External_RAM_Id__c != null || accInstance.External_SAS_Id__c != null) && 
                ((opp.Legal_Plan_Required__c && accInstance.Completed_Draft_Count__c == 1) || (!opp.Legal_Plan_Required__c && accInstance.Completed_Draft_Count__c == 2))) {
                    createAsyncOpLegalNetworkCommunication(accInstance); 
            }
                   
        }
        
        Set<Id> asyncOpIdsUpserted = AsyncOperationUtil.dmlCachedAsyncOperations();
        if (asyncType == AsyncOperationUtil.ASYNC_TYPE_ENUM.FUTURE && !accts.isEmpty() && String.isNotBlank(accts[0].External_SAS_Id__c)) {
            Account oldAccount = (Account)Trigger.oldMap.get(accts[0].Id);
            if(!oldAccount.Fee_Paid_In_Full__c && accts[0].Fee_Paid_In_Full__c){
                //FutureHandler.makeSetCustomerStatusAPI(accts[0].Id);
            }                         
        }
    }
    
    private static void createAsyncOpLegalNetworkCommunication(Account accInstance) {        
        AsyncOperationUtil.createAsyncOperationRecord(accInstance.Id, asyncType, AsyncOperationUtil.OPERATION_LEGAL_NETWORK_COMMUNICATION);       
    }
    
   /*private static void createAsyncOpSetCustomerStatusAPI(Account accInstance) {
        if (String.isNotBlank(accInstance.External_SAS_Id__c)) {
            Account oldAccount = (Account)Trigger.oldMap.get(accInstance.Id);
            if (!oldAccount.Fee_Paid_In_Full__c && accInstance.Fee_Paid_In_Full__c) {
                AsyncOperationUtil.createAsyncOperationRecord(accInstance.Id, asyncType, AsyncOperationUtil.OPERATION_SET_CUSTOMER_STATUS_API);
            }
        }
    }*/

    private static AsyncOperationUtil.ASYNC_TYPE_ENUM getAsyncType() {
        return Trigger.new.size() == 1 ? AsyncOperationUtil.ASYNC_TYPE_ENUM.FUTURE : AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH;
    }
}
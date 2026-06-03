public with sharing class AsyncOpLegalNetworkCommunication implements IAsyncOperation {

     public static void execute(Map<String, Object> inputMap, Map<String, Object> outputMap) {
        try {
            if (inputMap != null && !inputMap.isEmpty() && inputMap.containsKey('asyncOperationRecords')) {
                List<Async_Operation__c> asyncOperationRecords = (List<Async_Operation__c>)inputMap.get('asyncOperationRecords');
                if (asyncOperationRecords != null && !asyncOperationRecords.isEmpty()) {
                    processOperations(asyncOperationRecords);
                }
            }
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null);
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }
    
    public static void processOperations(List<Async_Operation__c> operations) {
        List<Async_Operation__c> asyncToCitadelList = new List<Async_Operation__c>();
        List<Async_Operation__c> asyncToVLP = new List<Async_Operation__c>();
        Map<Id, Async_Operation__c> asyncMap = new Map<Id, Async_Operation__c>();
        Map<Id, Account> acctVLPMap = new Map<Id, Account>();
        
        for (Async_Operation__c op : operations) {             
             if(op.Record_Id__c != null){
                 asyncMap.put(op.Record_Id__c, op);          
             }
        }
        
        for(Account acct: AccountData.queryAccounts(asyncMap.keyset())){ //[SELECT Id, Legal_Network__c FROM Account WHERE Id IN:asyncMap.keyset()]){
            if(asyncMap.containsKey(acct.Id)){
                if(acct.Legal_Network__c == AccountUtil.LEGAL_NETWORK_CITADEL){
                    asyncToCitadelList.add(asyncMap.get(acct.Id));
                }else if(acct.Legal_Network__c == AccountUtil.LEGAL_NETWORK_VLP){
                    asyncToVLP.add(asyncMap.get(acct.Id));
                    acctVLPMap.put(acct.Id, acct);
                }
            }
        }
        
        if(!asyncToCitadelList.isEmpty()){
            AsyncOpCitadelAPI.processOperations(asyncToCitadelList);
        } 
        
        if(!asyncToVLP.isEmpty() && acctVLPMap != null){
            VLPService.processOperations(asyncToVLP, acctVLPMap);
        } 
    }
}
/**
 * @Description: Class to process the values in RAMSettings custom metadata.
 */
public inherited sharing class AccountStatusMDT {    
    
    /**
     * @description: Method to get the account status based on processor status.
    */
    public static Account_Status_Mapping__mdt getAccountStatus(String processorStatus) {
        Account_Status_Mapping__mdt acctStatusMap = [SELECT Client_Status__c, Processor_Status__c, SAS_Status_Lookup_Id__c, RAM_Processor_Status__c FROM Account_Status_Mapping__mdt WHERE Processor_Status__c =:processorStatus];
        return acctStatusMap;
    }
    
    /**
     * @description: Method to get all the account status.
    */
    public static Map<String,Account_Status_Mapping__mdt> getAllAccountStatus() {
        Map<String,Account_Status_Mapping__mdt> acctStatusMap = new Map<String, Account_Status_Mapping__mdt>();
        for(Account_Status_Mapping__mdt acctStatusRec: [SELECT Client_Status__c, Processor_Status__c, SAS_Status_Lookup_Id__c, RAM_Processor_Status__c FROM Account_Status_Mapping__mdt]){
            if(!acctStatusMap.containsKey(acctStatusRec.Processor_Status__c)){
                acctStatusMap.put(acctStatusRec.Processor_Status__c, acctStatusRec);
            }            
        }
        return acctStatusMap;
    }
    
    public static Account_Status_Mapping__mdt filterByClientStatus(String clientStatus){
       Account_Status_Mapping__mdt acctStatusMap = [SELECT Client_Status__c, Processor_Status__c, SAS_Status_Lookup_Id__c, RAM_Processor_Status__c FROM Account_Status_Mapping__mdt WHERE Client_Status__c =:clientStatus];
       return acctStatusMap;    
    }
}
public with sharing class QualifiedFinancialController {
    
    @AuraEnabled
    public static void getAccountDetails(Id accId){
        try {
             ApexUtil.requireValue('Account Id', accId);
             Account acct = AccountData.queryAccount(accId)[0]; 
             if(acct.Net_Profit__c > 0){
                 acct.Qualified_Financial__c = true;
                 Update acct;
             } else{
                 throw new CustomException((System.Label.Share_Qualify_Financial_To_Affiliate));
             }          
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
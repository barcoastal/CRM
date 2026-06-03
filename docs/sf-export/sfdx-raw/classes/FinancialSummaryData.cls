/** Test Class: FinancialSummaryDataTest */
/**
 * @Description: Class to retrieve the financialsummary records.
 */
public inherited sharing class FinancialSummaryData {

     
    /**
     * @description: Method to query the financial summay record based on account Id.
     * @param acctId - Salesforce account Id
     * @return List<Financial_Summary__c> - returns the financial summary record in a list
     */
     public static List<Financial_Summary__c> getFinancialSummayDetail(Id acctId) {
         return [SELECT Id, Account__c,Actual_Program_Term__c,Actual_Weekly_Payment__c FROM Financial_Summary__c WHERE Account__c =:acctId];
     }
}
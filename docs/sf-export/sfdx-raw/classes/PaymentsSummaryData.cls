public inherited sharing class PaymentsSummaryData {
   
   public static List<Payment_Summary__c> queryPaymentsSummaryWithAccount(Set<Id> AccountIds) {
       return [SELECT Id, Name,Payment_Type__c,Total_Amount__c,Amount_Collected__c,Amount_in_Schedule__c,Client__c FROM Payment_Summary__c WHERE Client__c IN : AccountIds ];
   }

   public static List<Payment_Summary__c> queryPaymentsSummaryDraftRecordWithAccount(Set<Id> AccountIds) {
    return [SELECT Id, Name,Payment_Type__c,Total_Amount__c,Amount_Collected__c,Amount_in_Schedule__c, Client__c FROM Payment_Summary__c WHERE Client__c IN : AccountIds AND Payment_Type__c IN ('Draft','Escrow Amount')];
   }
   
   public static List<Payment_Summary__c> queryPaymentsSummarySettlementRecordWithAccount(Set<Id> AccountIds) {
    return [SELECT Id, Name,Payment_Type__c,Total_Amount__c,Amount_Collected__c,Amount_in_Schedule__c,Client__c FROM Payment_Summary__c WHERE Client__c IN : AccountIds AND Payment_Type__c =: 'Settlement'];
   }

   public static List<Payment_Summary__c> queryPaymentsSummaryWithAccountId(Id AccountId){
     return [SELECT Id, Name,Payment_Type__c,Total_Amount__c,Amount_Collected__c,Amount_in_Schedule__c,Client__c FROM Payment_Summary__c WHERE Client__c =: AccountId];
   }
}
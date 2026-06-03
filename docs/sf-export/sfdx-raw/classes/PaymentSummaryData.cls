public inherited sharing class PaymentSummaryData {

    /**
     * @description: Method to query the paymentSummary record based on account Id 
     * @param accId - Salesforce account Id
     * @param paymentTypes- Filter by payment summary payment types
     * @return List<Payment_Summary__c> - returns the payment summary record in a list
     */
    public static Map<Id, AggregateResult> queryPaymentSummariesFilterByAccount(Set<Id> accIds , Set<String> paymentTypes) {
        return new Map<Id, AggregateResult>([
            SELECT SUM(Amount_Collected__c) amountCollected, SUM(Total_Amount__c) totalAmount, Client__c Id 
            FROM Payment_Summary__c WHERE Client__c iN:accIds AND Payment_Type__c IN:paymentTypes GROUP BY Client__c
        ]);
    }    
}
trigger paymentSummaryTrigger on Payment_Summary__c (after update) {
    new PaymentSummaryHandler().run();
}
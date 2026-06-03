trigger FirstPaymentTrigger on First_Payment_Collection__c (before insert, before update, after insert, after update, after delete) {
      new FirstPaymentTriggerHandler().run();
}
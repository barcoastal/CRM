trigger feeTrigger on Fee__c (after insert, after update, after delete) {
    new FeeTriggerHandler().run();
}
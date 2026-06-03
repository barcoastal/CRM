/**
 * @Description: Draft trigger to initiate the logic in DraftTriggerHandler class.
 * Used to calculate the Debit Schedule records
 */
trigger draftTrigger on Draft__c (before insert, after insert, before update, after update, after delete) {
    //Method call to run the trigger logic in the handler class
    new DraftTriggerHandler().run();
}
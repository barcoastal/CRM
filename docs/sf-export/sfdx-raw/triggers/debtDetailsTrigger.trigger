/**
 * @Description: Debt Details trigger to initiate the logic in DebtDetailsTriggerHandler class.
 */
trigger debtDetailsTrigger on Debt_Details__c (after insert, after update, after delete, before update, before insert, before delete) {
    //Method call to run the trigger logic in the handler class
    new DebtDetailsTriggerHandler().run();
}
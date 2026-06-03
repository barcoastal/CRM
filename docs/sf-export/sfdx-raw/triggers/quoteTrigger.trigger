/**
 * @Description: Quote trigger to initiate the logic in QuoteTriggerHandler class.
 */
trigger quoteTrigger on Quote (before insert, before update, after insert, after update) {

    if (System.isFuture()) {
        return; //To skip the recursive update
    }

    //Method call to run the trigger logic in the handler class
    new QuoteTriggerHandler().run();
}
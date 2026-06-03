/**
 * @Description: Email Message trigger to initiate the logic in EmailMessageTriggerHandler class.
 */
trigger emailMessageTrigger on EmailMessage (after insert, before update, before insert, before delete) {
    //Method call to run the trigger logic in the handler class
    new EmailMessageTriggerHandler().run();
}
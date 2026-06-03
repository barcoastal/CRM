/**
 * @Description: Five9CallTrigger trigger to initiate the logic in Five9CallLogHandler class.
 */

trigger Five9CallLogTrigger on Five9_Call_Log__c (after Insert) {
    //Method call to run the trigger logic in the handler class
    new Five9CallLogTriggerHandler().run();    
}
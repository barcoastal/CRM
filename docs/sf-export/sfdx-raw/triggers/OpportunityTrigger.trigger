/**
 * @Description: Opportunity trigger to initiate the logic in LeadTriggerHandler class.
 */
trigger OpportunityTrigger on Opportunity (before update, before delete, after update, after insert) {
    if (!OpportunityTriggerHandler.byPassOpportunityTrigger) {
        //Method call to run the trigger logic in the handler class
        new OpportunityTriggerHandler().run();
    }
}
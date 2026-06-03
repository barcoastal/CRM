/**
 * @Description: OpportunityContactRole trigger to initiate the logic in OpportunityContactRoleTriggerHandler class.
 */
trigger opportunityContactRole on OpportunityContactRole (after insert, after update) {
    //Method call to run the trigger logic in the handler class
    new OpportunityContactRoleTriggerHandler().run();
}
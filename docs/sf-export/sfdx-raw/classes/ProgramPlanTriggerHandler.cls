public  without sharing class ProgramPlanTriggerHandler extends TriggerHandler {
    
    public override void beforeInsert() {
        validateLockOpportunityList(Trigger.new);
    }
    
    public override void beforeDelete() {
        validateLockOpportunityList(Trigger.old);
    }
    
    public override void beforeUpdate() {
        validateLockOpportunityList(Trigger.new);
    }
    
    private void validateLockOpportunityList(List<Program_Plan__c> recordsToBlock) {
        OpportunityLockService.validateLockOpportunity(recordsToBlock, 'Opportunity__c');
    }
}
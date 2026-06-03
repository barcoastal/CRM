public class OpportunityLineItemTriggerHandler extends TriggerHandler {
    public override void beforeInsert() {
        validateLockOpportunityList(Trigger.new);
    }
    
    public override void beforeDelete() {
        validateLockOpportunityList(Trigger.old);
    }
    
    public override void beforeUpdate() {
        validateLockOpportunityList(Trigger.new);
    }
    
    private void validateLockOpportunityList(List<OpportunityLineItem> recordsToBlock) {
        OpportunityLockService.validateLockOpportunity(recordsToBlock, 'OpportunityId');
    }
}
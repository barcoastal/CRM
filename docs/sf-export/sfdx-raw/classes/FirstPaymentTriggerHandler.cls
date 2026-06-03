public without sharing class FirstPaymentTriggerHandler extends TriggerHandler {
    
    public override void beforeInsert() {
        FirstPaymentHandler.handleBeforeInsert(Trigger.new);
    }
    
    public override void beforeUpdate() {
        
    }
    
    public override void afterInsert() {
        handleRollups();
    } 
    
    public override void afterUpdate() {
        handleRollups();
    }
    
    private static void handleRollups(){
        if (Trigger.isAfter) {
            Set<Id> userIds = new Set<Id>();
            List<First_Payment_Collection__c> records = Trigger.isDelete ? Trigger.old : Trigger.new;
            
            for(First_Payment_Collection__c fpc : records) {
                userIds.add(fpc.Closer__c);
            }
            FirstPaymentHandler.handleRollups(userIds);
        }
    }
}
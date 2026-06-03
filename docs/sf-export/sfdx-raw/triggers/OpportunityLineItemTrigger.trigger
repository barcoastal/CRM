trigger OpportunityLineItemTrigger on OpportunityLineItem (before update, before insert, before delete) {
    new OpportunityLineItemTriggerHandler().run();
}
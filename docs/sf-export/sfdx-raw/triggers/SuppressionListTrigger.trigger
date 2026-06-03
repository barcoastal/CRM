trigger SuppressionListTrigger on Suppression_List__e (after insert) {
    if (Trigger.isAfter && Trigger.isInsert) {
        SuppressionListTriggerHandler.handleAfterInsert(Trigger.new);
    }
}
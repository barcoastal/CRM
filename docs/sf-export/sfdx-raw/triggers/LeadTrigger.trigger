/**
 * @Description: Lead trigger to initiate the logic in LeadTriggerHandler class.
 */
trigger LeadTrigger on Lead (before insert, before update, after insert, after update, after delete) {

    if (System.isFuture()) {
        if (LeadTriggerHandler.runPopulateArchivedDateAndIsArchivedCheckboxInAsync == true && Trigger.isBefore && Trigger.isUpdate) {
            LeadAfterTriggerHelper.populateArchivedDateAndIsArchivedCheckbox();
        } else {
            return; //To skip the recursive update
        }
    }

    if (TriggerDisablementCheckSvc.isTriggerDisabled(Lead.getSObjectType().getDescribe().getName())) {
        return; // Exit trigger if disabled via TriggerDisablementCheckSvc
    }

    //Method call to run the trigger logic in the handler class
    if (!LeadTriggerHandler.byPassLeadTrigger) {
        new LeadTriggerHandler().run();
    }
}
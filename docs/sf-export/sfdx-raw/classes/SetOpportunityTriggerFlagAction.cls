public with sharing class SetOpportunityTriggerFlagAction {

    @InvocableMethod(label='Set Prevent Task Creation Flag')
    public static void setPreventTaskFlag() {
        OpportunityTriggerHandler.preventTaskCreationOnStageChange = true;
    }

}
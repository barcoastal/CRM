trigger ProgramPlanTrigger on Program_Plan__c (before update, before insert, before delete) {
    new ProgramPlanTriggerHandler().run();
}
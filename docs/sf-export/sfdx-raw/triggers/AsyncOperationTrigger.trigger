trigger AsyncOperationTrigger on Async_Operation__c (before insert) {

    if (TriggerDisablementCheckSvc.isTriggerDisabled(Async_Operation__c.getSObjectType().getDescribe().getName())) {
        return; // Exit trigger if disabled via TriggerDisablementCheckSvc
    }

    new AsyncOperationHandler().run();
}
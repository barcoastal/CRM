trigger TaskTrigger on Task (after insert, before delete, before insert, before update) {

    if (TriggerDisablementCheckSvc.isTriggerDisabled(Task.getSObjectType().getDescribe().getName())) {
        return; // Exit trigger if disabled via TriggerDisablementCheckSvc
    }

    new TaskHandler().run();
}
trigger EventTrigger on Event (after insert, before update, before insert, before delete) {
    
    if (TriggerDisablementCheckSvc.isTriggerDisabled(Event.getSObjectType().getDescribe().getName())) {
        return; // Exit trigger if disabled via TriggerDisablementCheckSvc
    }

    new EventHandler().run();
}
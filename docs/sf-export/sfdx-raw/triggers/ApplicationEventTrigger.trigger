trigger ApplicationEventTrigger on Application_Event__e (after insert) {

    ApplicationEventHandler.execute(trigger.new); 
}
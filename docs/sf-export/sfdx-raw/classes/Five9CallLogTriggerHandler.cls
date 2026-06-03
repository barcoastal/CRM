/**
 * @Description: Hander class to process the functionality on Five9CallLog trigger which extends TriggerHandler.
 */
public without sharing class Five9CallLogTriggerHandler extends TriggerHandler {
    
    /**
     * @description: Method to execute logic in the after insert trigger event.
     */
    public override void afterInsert() {
        Five9CallLogService.processFive9CallLogRecords(Trigger.new);                
    }
}
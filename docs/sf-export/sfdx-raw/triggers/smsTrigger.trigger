trigger smsTrigger on SMS__c (before insert, after insert) {
    if (Trigger.isBefore && Trigger.isInsert) {
        SMSHandler.processSMSRecords();
    }
    if (Trigger.isAfter && Trigger.isInsert) {
        new RelateSMSTaskHandler().createChildTask();
    }
}
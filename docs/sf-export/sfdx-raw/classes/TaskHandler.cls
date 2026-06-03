/*----------------------------------------------------------------
    Author: Vignesh
    Description: To send the custom notification to the user for the inbound message
    Test Class: TaskHandlerTest

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    June-18-2023    Vignesh                  Initial Development                50%
    
--------------------------------------------------------------------*/
public without sharing class TaskHandler extends TriggerHandler {

    public static final String CUSTOM_NOTIFICATION = 'Custom_Notification';
    public static CustomNotificationType customNotificationTypeRec;

    /**
     * @description: Method to execute logic in the before insert trigger event.
    */
    public override void beforeInsert() {
        TaskServices.populateSubjectWithDisposition(Trigger.new); 
        copyReminderDateTime(Trigger.new); 
        updateSubType(Trigger.new);
        validateLockOpportunityTask(Trigger.new);
    }

    /**
     * @description: Method to execute logic in the before update trigger event.
    */
    public override void beforeUpdate() {
        copyReminderDateTime(Trigger.new); 
        validateLockOpportunityTask(Trigger.new);
    }
    
    /**
     * @description: Method to execute logic in the before after insert trigger event.
    */
    public override void afterInsert() {
        TaskServices.populateLastCallLastEmail(Trigger.new); 
        TaskHandler.sendCustomNotification();
        
        // Extracting task IDs from Trigger.new and passing them to the future method
        List<Id> taskIds = new List<Id>();
        for(Task taskRecord : (List<Task>)Trigger.new) { 
            if(TaskServices.isLeadRelatedTask(taskRecord) || TaskServices.isOpportunityRelatedTask(taskRecord) || TaskServices.isAccountRelatedTask(taskRecord)) {
                taskIds.add(taskRecord.Id);
            }
        }
         
        //To avoid Future method cannot be called from a future or batch method issue.
         if(!System.isBatch() && !System.isFuture()) {
            TaskServicesAsync.asyncOperationsOnAfterInsert(taskIds);
        }
        
    }

    public static void sendCustomNotification() {
        List<Task> taskRecords = new List<Task>();
        Map<Id, Task> taskMap = new Map<Id, Task>();
        for (Task taskRecord : (List<Task>)Trigger.new) {
            if (TaskUtil.getRecordTypeId(TaskUtil.RT_SMS) == taskRecord.RecordTypeId
                && taskRecord.Parent_SMS__c != null) 
            {
                taskMap.put(taskRecord.Id, taskRecord);
            }
        }
        if (!taskMap.isEmpty()) {
            List<CustomNotificationType> notificationTypes = SetupObjectData.queryCustomNotificationType(CUSTOM_NOTIFICATION);
            if (notificationTypes != null && !notificationTypes.isEmpty()) {
                customNotificationTypeRec = notificationTypes[0];
            }
            Set<String> phoneNumbers = new Set<String>();
            Map<String, String> phoneNumberUserIdMap = new Map<String, String>();
            List<Task> queriedTasks =  TaskData.queryTasksForInboundSMS(taskMap.keySet());
            for (Task taskRecord : queriedTasks) {
                String phoneNumber1 = taskRecord.Parent_SMS__r.To_Phone__c;
                String phoneNumber2;
                if (phoneNumber1 != null) {
                    phoneNumbers.add(phoneNumber1);
                    if (phoneNumber1.startsWith('+1')) {
                        phoneNumber2 = phoneNumber1.removeStart('+1');
                    } else {
                        phoneNumber2 = '+1' + phoneNumber1;
                    }
                    phoneNumbers.add(phoneNumber2);
                }
            }
            for (User userRec : [SELECT Id, Twilio_Phone__c FROM User WHERE Twilio_Phone__c IN :phoneNumbers]) {
                phoneNumberUserIdMap.put(userRec.Twilio_Phone__c, userRec.Id);
            }
            for (Task taskRecord : queriedTasks) {
                sendSMSNotification(taskRecord, phoneNumberUserIdMap);
            }
            //Publish dummy platform event to refresh the SMS LWC
            SMS_Notification__e sms = new SMS_Notification__e();
            Eventbus.publish(sms);
        }
    }

    private static void sendSMSNotification(Task taskRecord, Map<String, Id> phoneNumberUserIdMap) {
        if (phoneNumberUserIdMap.containsKey(taskRecord.Parent_SMS__r.To_Phone__c)) {
            Messaging.CustomNotification notification = new Messaging.CustomNotification();
            notification.setTitle('Received SMS from ' + taskRecord.Parent_SMS__r.From_Phone__c);
            notification.setBody(taskRecord.Parent_SMS__r.Message_Body__c);
            notification.setNotificationTypeId(customNotificationTypeRec.Id);
            notification.setTargetId(taskRecord.whoId != null ? taskRecord.whoId : taskRecord.whatId);
            try {
                notification.send(new Set<String>{phoneNumberUserIdMap.get(taskRecord.Parent_SMS__r.To_Phone__c)});
            }
            catch (Exception e) {
                System.debug('Problem sending notification: ' + e.getMessage());
            }
        }
    }

    /**
     * @description: Method to execute logic in the before delete trigger event.
    */
    public override void beforeDelete() {
        Boolean restrictTaskDeletion = FeatureManagement.checkPermission('Restrict_Task_Deletion');
        if (restrictTaskDeletion) {
            for (Task leadRec : (List<Task>)Trigger.old) {
                leadRec.addError('Deletion of Task is not allowed.');
            }
        }
        validateLockOpportunityTask(Trigger.old);
    }

    public static void copyReminderDateTime(List<Task> tasksList) {
        for (Task taskRec : tasksList) {
            if (isEligibleToPopulateRecentReminderDateTime(taskRec)) {
                taskRec.Task_Reminder__c = taskRec.ReminderDateTime;
            }
            if (isEligibleToPopulateDueDate(taskRec)) {
                taskRec.ActivityDate = taskRec.Task_Reminder__c.date();
            }
        }
    }
    
    public static void updateSubType(List<Task> tasksList) {
        for (Task taskRec : tasksList) {
            if(taskRec.Five9__Five9TaskType__c == 'Call'){
                taskRec.TaskSubtype = 'Call'; 
            }
            if(taskRec.Five9__Five9TaskType__c == 'Email'){
                taskRec.TaskSubtype = 'Email'; 
            }
        }
    }

    private static Boolean isEligibleToPopulateRecentReminderDateTime(Task taskRec) {
        Boolean isEligible = false;
        if (Trigger.isInsert && taskRec.ReminderDateTime != null && taskRec.IsReminderSet == true) {
            isEligible = true;
        } else if (Trigger.isUpdate && taskRec.IsReminderSet == true) {
            Task oldTask = (Task)Trigger.oldMap.get(taskRec.Id);
            isEligible = taskRec.ReminderDateTime != oldTask.ReminderDateTime || taskRec.IsReminderSet != oldTask.IsReminderSet;
        }
        return isEligible;
    }

    private static Boolean isEligibleToPopulateDueDate(Task taskRec) {
        Boolean isEligible = false;
        if (Trigger.isInsert && taskRec.Task_Reminder__c != null) {
            isEligible = true;
        } else if (Trigger.isUpdate) {
            Task oldTask = (Task)Trigger.oldMap.get(taskRec.Id);
            isEligible = taskRec.Task_Reminder__c != oldTask.Task_Reminder__c;
        }
        return isEligible;
    }
    private void validateLockOpportunityTask(List<Task> taskRecords) {
        Set<Id> oppIds = new Set<Id>();
        for (Task t : taskRecords) {
            if (t.WhatId != null && ApexUtil.getSObjectName(t.WhatId) == 'Opportunity') {
                oppIds.add(t.WhatId);
            }
        }
        
        Map<Id, Opportunity> archivedOppMap = OpportunityData.getArchivedOpportunities(oppIds);
        
        List<Task> oppTaskRecords = new List<Task>();
        for (Task t : taskRecords) {
            if (archivedOppMap.containsKey(t.WhatId)) {
                oppTaskRecords.add(t);
            }
        }
        
        if (!oppTaskRecords.isEmpty()) {
            OpportunityLockService.validateLockOpportunity(oppTaskRecords, 'WhatId');
        }
    }

}
public class CreateSMSTaskInvocable {
    // Wrapper class for input parameters
    public class SMSRequest {
        @InvocableVariable(label='Recipient ID' description='ID of the Recipient (Prospect/Contact/Lead)' required=true)
        public String recipientId;
        
        @InvocableVariable(label='Unique Identifier' description='Unique ID for the SMS logging Task' required=true)
        public String uniqueIdentifier;
        
        @InvocableVariable(label='Converse App Name' description='Name of the Converse App record' required=true)
        public String converseAppName;
    }

    @InvocableMethod(label='Create SMS Tasks' description='Creates Tasks and Converse App Tasks for SMS notifications')
    public static void createSMSTasks(List<SMSRequest> requests) {
        List<Task> triggerTasksToInsert = new List<Task>();
        List<smagicinteract__Converse_App_Task__c> converseTasksToInsert = new List<smagicinteract__Converse_App_Task__c>();
        List<Task> loggingTasks = new List<Task>();
        Map<Integer, SMSRequest> requestsByIndex = new Map<Integer, SMSRequest>();
        Integer index = 0;

        // Process each request
        for (SMSRequest request : requests) {
            if (String.isBlank(request.recipientId) || 
                String.isBlank(request.uniqueIdentifier) || 
                String.isBlank(request.converseAppName)) {
                System.debug('Skipping request due to missing fields: ' + request);
                continue;
            }

            // Validate recipientId as Contact or Lead
            Id whoId;
            String objName;
            try {
                whoId = (Id)request.recipientId;
                Schema.SObjectType objType = whoId.getSObjectType();
                objName = objType.getDescribe().getName();
                if (objName != 'Contact' && objName != 'Lead') {
                    System.debug('Invalid recipientId, not a Contact or Lead: ' + request.recipientId);
                    continue;
                }
            } catch (Exception e) {
                System.debug('Invalid recipientId: ' + request.recipientId + ', Error: ' + e.getMessage());
                continue;
            }

            // Query Converse App
            List<smagicinteract__Converse_App__c> converseApps = [
                SELECT Id
                FROM smagicinteract__Converse_App__c
                WHERE Name = :request.converseAppName
                LIMIT 1
            ];

            if (converseApps.isEmpty()) {
                System.debug('Converse App not found: ' + request.converseAppName);
                continue;
            }

            Id converseAppId = converseApps[0].Id;

            // Query Converse App Actions (get first available)
            List<smagicinteract__Converse_App_Action__c> actions = [
                SELECT Id, smagicinteract__Automation_Key__c, smagicinteract__SMS_Template__r.smagicinteract__Name__c
                FROM smagicinteract__Converse_App_Action__c
                WHERE smagicinteract__Converse_App__c = :converseAppId
                LIMIT 1
            ];

            if (actions.isEmpty()) {
                System.debug('No actions found for Converse App: ' + request.converseAppName);
                continue;
            }

            // Create trigger Task
            Task triggerTask = new Task();
            triggerTask.Subject = 'sms message';
            triggerTask.Description = actions[0].smagicinteract__Automation_Key__c;
            triggerTask.WhoId = whoId;
            triggerTask.Status = 'Open';
            triggerTask.Priority = 'Normal';
            triggerTasksToInsert.add(triggerTask);

            // Create Converse App Task
            smagicinteract__Converse_App_Task__c converseTask = new smagicinteract__Converse_App_Task__c();
            converseTask.smagicinteract__Automation_Key_Reference__c = actions[0].smagicinteract__Automation_Key__c;
            converseTask.smagicinteract__Converse_App_Action__c = actions[0].Id;
            converseTask.smagicinteract__Template__c = actions[0].smagicinteract__SMS_Template__c;
            converseTask.smagicinteract__Type__c = 'Automation';
            if (objName == 'Contact') {
                converseTask.smagicinteract__Contact__c = whoId;
            } else {
                converseTask.smagicinteract__Lead__c = whoId;
            }
            converseTasksToInsert.add(converseTask);

            // Create logging Task
            Task loggingTask = new Task();
            loggingTask.Subject = 'SMS Message';
            loggingTask.Description = 'SMS sent with unique identifier: ' + request.uniqueIdentifier;
            loggingTask.WhoId = whoId;
            loggingTask.Status = 'Completed';
            loggingTask.Priority = 'Normal';
            loggingTasks.add(loggingTask);

            requestsByIndex.put(index, request);
            index++;
        }

        // Insert trigger Tasks
        if (!triggerTasksToInsert.isEmpty()) {
            try {
                insert triggerTasksToInsert;
            } catch (Exception e) {
                System.debug('Error inserting trigger Tasks: ' + e.getMessage());
            }
        }

        // Insert Converse App Tasks
        if (!converseTasksToInsert.isEmpty()) {
            try {
                insert converseTasksToInsert;
            } catch (Exception e) {
                System.debug('Error inserting Converse App Tasks: ' + e.getMessage());
            }
        }

        // Insert logging Tasks
        if (!loggingTasks.isEmpty()) {
            try {
                insert loggingTasks;
            } catch (Exception e) {
                System.debug('Error inserting logging Tasks: ' + e.getMessage());
            }
        }
    }
}
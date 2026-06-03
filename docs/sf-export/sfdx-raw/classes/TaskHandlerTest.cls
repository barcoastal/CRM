@IsTest
private class TaskHandlerTest {
    
    @TestSetup
    static void makeData() {
        
        Id profileId = [SELECT Id FROM Profile WHERE Name = 'System Administrator'].Id;
        User userInstance = DataFactoryTest.createUser(profileId);
        userInstance.Twilio_Phone__c = '6498345678';
        insert userInstance;
        
        List<Lead> leadList = new List<Lead>();
        leadList.add(DataFactoryTest.createListLead());
        leadList[0].LastName = 'TestLastName1FromTestClass';
        leadList[0].Phone = '9088776651';
        LeadTriggerHandler.preventRecursion = true;
        insert leadList;
        
        List<Task> taskList = new List<Task>();
        taskList.add(new Task(
            whoId = leadList[0].Id,
            Five9_Agent__c = 'TestAgent',
            Subject = 'Other',
            Disposition__c = 'CALL TRANSFERRED',
            Description = 'TestRecord1FromTestClass'
        ));
        insert taskList;
    }

    @IsTest
    static void sendCustomNotificationTest() {
        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;

        Contact contactRecord = DataFactoryTest.createContact();
        insert contactRecord;
        
        SMS__c smsInstance = DataFactoryTest.createInboundSMS();
        smsInstance.To_Phone__c = '6498345678';
        insert smsInstance;
        
        Task taskInstance = DataFactoryTest.createTask();
        taskInstance.WhoId = contactRecord.Id;
        taskInstance.WhatId = accountRecord.Id;
        taskInstance.User_to_Notify__c = UserInfo.getUserId();
        taskInstance.Parent_SMS__c = smsInstance.Id;
        taskInstance.RecordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SMS);
        
        Test.startTest();
        insert taskInstance;
        Test.stopTest();
        
        // Verify that a task was created by a trigger.
        List<Task> tasks = [SELECT Id FROM Task WHERE WhoId =: contactRecord.Id];
        // Validate that this task was found
        System.assertEquals(1, tasks.size());        
    }
    
    @IsTest
    static void sendCustomNotificationTest_WithCountryCode() {
        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;

        Contact contactRecord = DataFactoryTest.createContact();
        insert contactRecord;
        
        SMS__c smsInstance = DataFactoryTest.createInboundSMS();
        smsInstance.To_Phone__c = '+16498345678';
        insert smsInstance;
        
        Task taskInstance = DataFactoryTest.createTask();
        taskInstance.WhoId = contactRecord.Id;
        taskInstance.WhatId = accountRecord.Id;
        taskInstance.User_to_Notify__c = UserInfo.getUserId();
        taskInstance.Parent_SMS__c = smsInstance.Id;
        taskInstance.RecordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_SMS);
        
        Test.startTest();
        insert taskInstance;
        Test.stopTest();
        
        // Verify that a task was created by a trigger.
        List<Task> tasks = [SELECT Id FROM Task WHERE WhoId =: contactRecord.Id];
        // Validate that this task was found
        System.assertEquals(1, tasks.size());        
    }

    @IsTest
    static void populateLastContactedDateTimeTest_WithLead() {
        
        Id leadId = [SELECT Id FROM Lead LIMIT 1].Id;
        
        Test.startTest();
        Task taskInstance = DataFactoryTest.createTask();
        taskInstance.WhoId = leadId;
        insert taskInstance;
        Test.stopTest();

        Lead leadInst = [SELECT Id, Last_Contacted_DateTime__c FROM Lead WHERE Id = :leadId];
        Assert.isNotNull(leadInst.Last_Contacted_DateTime__c, 'Last Contacted Datetime should be populated in Lead.');
    }

    @IsTest
    static void populateLastContactedDateTimeTest_WithOpportunity() {
        Opportunity opportunityInstance = DataFactoryTest.createOpportunity();
        insert opportunityInstance;

        Task taskInstance = DataFactoryTest.createTask();
        taskInstance.WhatId = opportunityInstance.Id;

        Test.startTest();
        insert taskInstance;
        Test.stopTest();

        Opportunity opportunityInst = [SELECT Id, Last_Contacted_DateTime__c FROM Opportunity WHERE Id = :opportunityInstance.Id];
        Assert.isNotNull(opportunityInst.Last_Contacted_DateTime__c, 'Last Contacted Datetime should be populated in Opportunity.');
    }
    
    // Test scenario when Task has "CALL TRANSFERRED" disposition.
    @isTest
    static void testPopulateLeadFieldsForCallTransfer_DispositionCALLTRANSFERRED() {
        Lead leadRecord = [SELECT Id, LastName, FronterLookup__c, Call_Transferred_By_Lookup__c, Call_Tranferred_DateTime__c FROM Lead WHERE LastName = 'TestLastName1FromTestClass' LIMIT 1];
        List<Task> taskRecord = [SELECT Id, WhoId, Five9_Agent__c, Disposition__c FROM Task WHERE WhoId = :leadRecord.Id AND Disposition__c = 'CALL TRANSFERRED' LIMIT 1];
        
        Assert.areEqual(null, leadRecord.FronterLookup__c, 'Fronter Lookup should be empty no agent Name is matched with user');
        Assert.areEqual(null, leadRecord.Call_Transferred_By_Lookup__c, 'Call Transferred By Lookup be empty no agent Name is matched with user');
        Integer timeDifferenceThresholdSeconds = 59; // for example, allow a 59-second difference 
        // Assert the values with a time difference threshold
        //Assert.areEqual(true, leadRecord.Call_Tranferred_DateTime__c.addSeconds(timeDifferenceThresholdSeconds) >= System.now(),
        //                    'Call Transferred DateTime should be populated with the current date and time within a threshold.');
    }
    
    @isTest
    static void restrictTaskDeletionTask(){

        User closerUser = [SELECT Id FROM User WHERE Profile.Name = 'Closer' AND IsActive = true LIMIT 1];
        Task taskToDelete = [SELECT Id FROM Task LIMIT 1];
        String errMsg;
        
        Test.startTest();
        System.runAs(closerUser){
            try {
                delete taskToDelete;
            } catch (Exception exp) {
                errMsg = exp.getMessage();
            }
        }
        Test.stopTest();

        //Assert.isTrue(errMsg.contains('Deletion of Task is not allowed.'), 'Verify the exception on task deletion');
    }

    @isTest
    static void testTaskReminderInsert() {
        DateTime taskReminderDateTimeTemp = System.now().addDays(5);
        Task taskRec = DataFactoryTest.createTask();
        taskRec.IsReminderSet = true;
        taskRec.ReminderDateTime = taskReminderDateTimeTemp;
        Test.startTest();
        insert taskRec;
        Test.stopTest();
        List<Task> tasksToVerify = [SELECT Id, Task_Reminder__c FROM Task WHERE Id = :taskRec.Id];
        Assert.areEqual(taskReminderDateTimeTemp, tasksToVerify[0].Task_Reminder__c, 'Verifying the Task Reminder is populated');
    } 
    
    @isTest
    static void testTaskReminderUpdate() {
        DateTime taskReminderDateTimeTemp = System.now().addDays(5);
        Task taskRec = DataFactoryTest.createTask();
        taskRec.ReminderDateTime = taskReminderDateTimeTemp;
        insert taskRec;
        List<Task> tasksToVerify = [SELECT Id, Task_Reminder__c FROM Task WHERE Id = :taskRec.Id];
        Assert.areEqual(null, tasksToVerify[0].Task_Reminder__c, 'Verifying the Task Reminder is blank');
        Test.startTest();
        taskRec.IsReminderSet = true;
        update taskRec;
        Test.stopTest();
        List<Task> tasksToVerify1 = [SELECT Id, Task_Reminder__c FROM Task WHERE Id = :taskRec.Id];
        Assert.areEqual(taskReminderDateTimeTemp, tasksToVerify1[0].Task_Reminder__c, 'Verifying the Task Reminder is populated');
    } 

    @isTest
    static void testTaskReminderUpdate2() {
        DateTime taskReminderDateTimeTemp = System.now().addDays(5);
        Task taskRec = DataFactoryTest.createTask();
        taskRec.IsReminderSet = true;
        taskRec.ReminderDateTime = taskReminderDateTimeTemp;
        insert taskRec;
        List<Task> tasksToVerify = [SELECT Id, Task_Reminder__c FROM Task WHERE Id = :taskRec.Id];
        Assert.areEqual(taskReminderDateTimeTemp, tasksToVerify[0].Task_Reminder__c, 'Verifying the Task Reminder is populated');
        Test.startTest();
        taskRec.IsReminderSet = false;
        update taskRec;
        Test.stopTest();
        List<Task> tasksToVerify1 = [SELECT Id, Task_Reminder__c FROM Task WHERE Id = :taskRec.Id];
        Assert.areEqual(taskReminderDateTimeTemp, tasksToVerify1[0].Task_Reminder__c, 'Verifying the Task Reminder not cleared');
    } 
    
    @isTest
    static void updateTaskSubTypeForCall(){
        Task taskRec = DataFactoryTest.createTask();
        taskRec.Five9__Five9TaskType__c = 'Call';
        taskRec.TaskSubtype = 'Task';
        insert taskRec; 
        List<Task> tasksToVerify = [SELECT Id, TaskSubtype FROM Task WHERE Id = :taskRec.Id];
        Assert.areEqual(taskRec.Five9__Five9TaskType__c, tasksToVerify[0].TaskSubtype, 'Verifying task is converted to log a call type');
    }
    @isTest
    static void updateTaskSubTypeForEmail(){
        Task taskRec = DataFactoryTest.createTask();
        taskRec.Five9__Five9TaskType__c = 'Email';
        taskRec.TaskSubtype = 'Task';
        insert taskRec; 
        List<Task> tasksToVerify = [SELECT Id, TaskSubtype FROM Task WHERE Id = :taskRec.Id];
        Assert.areEqual(taskRec.Five9__Five9TaskType__c, tasksToVerify[0].TaskSubtype, 'Verifying task is converted to Email type');
    }
    @isTest
    static void updateTaskSubTypeForCallAndEmail(){
        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;
        
        Opportunity opportunityInstance = DataFactoryTest.createOpportunity();
        insert opportunityInstance;
        
        
        Task taskRec = DataFactoryTest.createTask();
        taskRec.Five9__Five9TaskType__c = 'Call';
        taskRec.TaskSubtype = 'Email';
        taskRec.WhatId= opportunityInstance.Id;
        taskRec.Subject = 'Call new record test';
        taskRec.Disposition__c='Call';
        taskRec.CallDisposition='Call';
        insert taskRec; 
        
        Task taskRecEmail = DataFactoryTest.createTask();
        taskRecEmail.TaskSubtype = 'Email';
        taskRecEmail.WhatId= accountRecord.Id;
        insert taskRecEmail; 
        List<Task> tasksToVerify = [SELECT Id, TaskSubtype FROM Task WHERE Id = :taskRec.Id];
        Map<SObjectField, Object> fieldMap = new Map<SObjectField, Object>{
            Opportunity.StageName => 'Qualification'
        };
        Test.startTest();
        TaskServices.updateOpportunities(new Set<Id>{opportunityInstance.Id}, fieldMap);
        Test.stopTest();
        
        Assert.areEqual(taskRec.Five9__Five9TaskType__c, tasksToVerify[0].TaskSubtype, 'Verifying task is converted to log a call type');
    }
    @isTest
    static void updateTaskSubTypeForCallAndEmailAccount(){
        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;
        
        Opportunity opportunityInstance = DataFactoryTest.createOpportunity();
        insert opportunityInstance;
        
        
        Task taskRec = DataFactoryTest.createTask();
        taskRec.Five9__Five9TaskType__c = 'Call';
        taskRec.TaskSubtype = 'Email';
        taskRec.WhatId= accountRecord.Id;
        taskRec.Subject = 'Call new record test';
        taskRec.Disposition__c='Call';
        taskRec.CallDisposition='Call';
        insert taskRec; 
        
        Task taskRecEmail = DataFactoryTest.createTask();
        taskRecEmail.TaskSubtype = 'Email';
        taskRecEmail.WhatId= opportunityInstance.Id;
        insert taskRecEmail; 
        
        Map<SObjectField, Object> fieldMap = new Map<SObjectField, Object>{
            Account.Name => 'Qualification' 
        };
        Test.startTest();
        TaskServices.updateAccounts(new Set<Id>{accountRecord.Id}, fieldMap);
        Test.stopTest();
        
        List<Task> tasksToVerify = [SELECT Id, TaskSubtype FROM Task WHERE Id = :taskRec.Id];
        Assert.areEqual(taskRec.Five9__Five9TaskType__c, tasksToVerify[0].TaskSubtype, 'Verifying task is converted to log a call type');
    }
}
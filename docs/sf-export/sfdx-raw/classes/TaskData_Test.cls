@IsTest
private class TaskData_Test {

    @IsTest
    static void queryTasksForInboundSMSTest() {
        
        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;

        Contact contactRecord = DataFactoryTest.createContact();
        insert contactRecord;
        
        SMS__c smsInstance = DataFactoryTest.createInboundSMS();
        insert smsInstance;
        
        Task taskInstance = DataFactoryTest.createTask();
        taskInstance.WhoId = contactRecord.Id;
        taskInstance.WhatId = accountRecord.Id;
        taskInstance.User_to_Notify__c = UserInfo.getUserId();
        taskInstance.Parent_SMS__c = smsInstance.Id;
        insert taskInstance;
        
        Test.startTest();
        List<Task> taskList = TaskData.queryTasksForInboundSMS(new Set<Id> {taskInstance.Id});
        Test.stopTest();
        
        System.assertEquals(UserInfo.getUserId(), taskList[0].User_to_Notify__c);
        System.assertEquals(accountRecord.Id, taskList[0].WhatId);
        System.assertEquals(contactRecord.Id, taskList[0].WhoId);
        System.assertEquals('Test SMS', taskList[0].Parent_SMS__r.Message_Body__c);
        System.assertEquals('6498345678', taskList[0].Parent_SMS__r.To_Phone__c);
        System.assertEquals('8734560945', taskList[0].Parent_SMS__r.From_Phone__c);
        System.assertEquals(true, taskList[0].Parent_SMS__r.Is_Inbound__c);
        System.assertEquals('Test Subject', taskList[0].Subject);
    }
    
    @isTest
    static void getChecklistItemsTest() {
        
        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;
        
        Contact contactRecord = DataFactoryTest.createContact();
        insert contactRecord;
        
        Checklist__c checkList = new Checklist__c(Name = 'Active', Account__c = accountRecord.Id, Active__c = True);
        insert checkList;
        
        Task taskRecord = new Task();
        taskRecord.RecordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_CHECKLIST_ITEM);
        taskRecord.Subject = 'Test Subject';
        taskRecord.ActivityDate = System.today();
        taskRecord.Status = 'In Progress';
        taskRecord.Description = 'Test Description';
        taskRecord.Checklist__c = checkList.Id;
        taskRecord.WhoId = contactRecord.Id;
        insert taskRecord;
        
        Test.startTest();
        List<Task> taskList = TaskData.getChecklistItems(contactRecord.Id, checkList.Id, True);
        Test.stopTest();
        
        Assert.areEqual(1, taskList.size());
        Assert.areEqual('Test Subject', taskList[0].Subject);
        Assert.areEqual('Test Description', taskList[0].Description);
    }
    
    @isTest
    static void getChecklistItemsOfPersonTest() {
        
        Contact contactRecord = DataFactoryTest.createContact();
        insert contactRecord;
        
        Checklist__c checkList = new Checklist__c(Name = 'Active', Active__c = True);
        insert checkList;
        
        Task taskRecord = new Task();
        taskRecord.RecordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_CHECKLIST_ITEM);
        taskRecord.Subject = 'Test Subject';
        taskRecord.ActivityDate = System.today();
        taskRecord.Status = 'In Progress';
        taskRecord.Description = 'Test Description';
        taskRecord.Checklist__c = checkList.Id;
        taskRecord.WhoId = contactRecord.Id;
        insert taskRecord;
        
        Test.startTest();
        List<Task> taskList = TaskData.getChecklistItemsOfPerson(contactRecord.Id);
        Test.stopTest();
        
        Assert.areEqual(1, taskList.size());
        Assert.areEqual('Test Subject', taskList[0].Subject);
        Assert.areEqual('Test Description', taskList[0].Description);
    }
    
    @isTest
    static void testqueryOpenTasks(){
        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;
        
        Contact contactRecord = DataFactoryTest.createContact();
        insert contactRecord;
        
        Task taskRecord = new Task();
        taskRecord.Subject = 'Test Subject';
        taskRecord.ActivityDate = System.today();
        taskRecord.Status = 'In Progress';
        taskRecord.Description = 'Test Description';
        taskRecord.WhoId = contactRecord.Id;
        taskRecord.WhatId = accountRecord.Id;
        insert taskRecord;
        
        Test.startTest();
        List<Task> taskList = TaskData.queryOpenTasks(new Set<Id>{accountRecord.Id});
        Test.stopTest();
        Assert.areEqual(1, taskList.size());
    }
}
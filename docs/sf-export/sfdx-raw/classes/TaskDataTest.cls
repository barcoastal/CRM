@IsTest
private class TaskDataTest {
    
    @TestSetup
    static void testSetup(){
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
        taskInstance.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_CHECKLIST_ITEM);
        insert taskInstance;
        
         Task taskInstance1 = DataFactoryTest.createTask();
        taskInstance1.WhoId = contactRecord.Id;
        taskInstance1.WhatId = accountRecord.Id;
        taskInstance1.User_to_Notify__c = UserInfo.getUserId();
        taskInstance1.Parent_SMS__c = smsInstance.Id;
        taskInstance1.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_CHECKLIST_ITEM);
        taskInstance1.Status = TaskUtil.COMPLETED_STATUS;
        taskInstance1.Subject = 'Welcome Call Completed';
        insert taskInstance1;
    }

    @IsTest
    static void queryTasksForInboundSMSTest() {
        
        List<Task> taskList1 = [Select Id,User_to_Notify__c,Parent_SMS__c,WhatId,WhoId ,recordTypeId,Status ,Subject from Task];
        Account accountRecord = [Select Id From Account limit 1];
        Contact contactRecord = [Select Id from Contact limit 1];
        Test.startTest(); 
        List<Task> taskList = TaskData.queryTasksForInboundSMS(new Set<Id> {taskList1[0].Id});
        Test.stopTest();
        
        System.assertEquals(UserInfo.getUserId(), taskList[0].User_to_Notify__c);
        System.assertEquals(accountRecord.Id, taskList[0].WhatId);
        System.assertEquals('Test SMS', taskList[0].Parent_SMS__r.Message_Body__c);
        System.assertEquals('6498345678', taskList[0].Parent_SMS__r.To_Phone__c);
        System.assertEquals('8734560945', taskList[0].Parent_SMS__r.From_Phone__c);
        System.assertEquals(true, taskList[0].Parent_SMS__r.Is_Inbound__c);
        System.assertEquals('Test Subject', taskList[0].Subject);
    }
    
      @IsTest
      static void getChecklistItemsOfPersonTest(){
         
        Contact contactRecord = [Select Id from Contact limit 1];

        Test.startTest(); 
        List<Task> taskList = TaskData.getChecklistItemsOfPerson(contactRecord.Id);
        Test.stopTest();
    }
    
      @IsTest
      static void queryOpenTasksTest(){
         
        Account accountRecord = [Select Id From Account limit 1];

        Test.startTest(); 
        List<Task> taskList = TaskData.queryOpenTasks(new Set<Id> {accountRecord.Id});
        Test.stopTest();
           
        System.assertEquals('Test Subject', taskList[0].Subject);
        System.assertEquals(accountRecord.Id, taskList[0].WhatId);
        System.assertNotEquals(TaskUtil.COMPLETED_STATUS, taskList[0].Status);
    }
    
      @IsTest
      static void queryWelcomeCallCompletedTasksTest(){
         
        Account accountRecord = [Select Id From Account limit 1];

        Test.startTest(); 
        List<Task> taskList = TaskData.queryWelcomeCallCompletedTasks(accountRecord.Id);
        Test.stopTest();
            
        System.assertEquals('Welcome Call Completed', taskList[0].Subject);
        System.assertEquals(accountRecord.Id, taskList[0].WhatId);
        System.assertEquals(TaskUtil.COMPLETED_STATUS, taskList[0].Status);
    }
    
     @IsTest
     static void getChecklistItemsTest(){
         
        Contact contactRecord = [Select Id from Contact limit 1];
        Account accountRecord = [Select Id From Account limit 1];

        Test.startTest(); 
        List<Task> taskList = TaskData.getChecklistItems(accountRecord.Id,accountRecord.Id,false);
        Test.stopTest();
                   
        System.assertEquals('Test Subject', taskList[0].Subject);
        System.assertEquals(accountRecord.Id, taskList[0].WhatId);

    }
    
    
}
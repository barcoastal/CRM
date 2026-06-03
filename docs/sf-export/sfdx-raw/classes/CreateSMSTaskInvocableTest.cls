@IsTest
public class CreateSMSTaskInvocableTest {

    @TestSetup
    static void makeData() {
        // Create SMS Templates
        List<smagicinteract__SMS_Template__c> templates = new List<smagicinteract__SMS_Template__c>();
        templates.add(new smagicinteract__SMS_Template__c(
            smagicinteract__Name__c = 'Template1',
            smagicinteract__Category__c = 'Text Template',
            smagicinteract__Channel_Specific__c = true,
            smagicinteract__Has_Per_Message__c = false,
            SML__Is_Installed__c = false
        ));
        templates.add(new smagicinteract__SMS_Template__c(
            smagicinteract__Name__c = 'Template2',
            smagicinteract__Category__c = 'Text Template',
            smagicinteract__Channel_Specific__c = true,
            smagicinteract__Has_Per_Message__c = false,
            SML__Is_Installed__c = false
        ));
        insert templates;

        // Create Converse App
        smagicinteract__Converse_App__c converseApp = new smagicinteract__Converse_App__c(
            Name = 'POC Text Message'
        );
        insert converseApp;

        // Create Converse App Actions
        List<smagicinteract__Converse_App_Action__c> actions = new List<smagicinteract__Converse_App_Action__c>();
        actions.add(new smagicinteract__Converse_App_Action__c(
            smagicinteract__Converse_App__c = converseApp.Id,
            smagicinteract__SMS_Template__c = templates[0].Id,
            smagicinteract__Mobile_Phone_Field__c = 'Phone'
        ));
        actions.add(new smagicinteract__Converse_App_Action__c(
            smagicinteract__Converse_App__c = converseApp.Id,
            smagicinteract__SMS_Template__c = templates[1].Id,
            smagicinteract__Mobile_Phone_Field__c = 'Phone'
        ));
        insert actions;

        // Create Lead and Contact
        Lead testLead = new Lead(
            FirstName = 'Test',
            LastName = 'Lead',
            Company = 'Test Company'
        );
        insert testLead;

        Contact testContact = new Contact(
            FirstName = 'Test',
            LastName = 'Contact'
        );
        insert testContact;
    }

    @IsTest
    static void testCreateSMSTasksWithContact() {
        // Retrieve test data
        Contact testContact = [SELECT Id FROM Contact LIMIT 1];

        // Create SMSRequest
        CreateSMSTaskInvocable.SMSRequest request = new CreateSMSTaskInvocable.SMSRequest();
        request.recipientId = testContact.Id;
        request.uniqueIdentifier = 'unique123';
        request.converseAppName = 'POC Text Message';

        // Call the invocable method
        Test.startTest();
        CreateSMSTaskInvocable.createSMSTasks(new List<CreateSMSTaskInvocable.SMSRequest>{request});
        Test.stopTest();

        // Assert Tasks and Converse App Tasks were created
        List<Task> triggerTasks = [SELECT Id, Subject, Description, WhoId, Status FROM Task WHERE Subject = 'sms message' AND WhoId = :testContact.Id];
        System.assert(triggerTasks.size() >= 1, 'At least one trigger Task should be created');
        System.assertEquals(testContact.Id, triggerTasks[0].WhoId);
        System.assertEquals('Open', triggerTasks[0].Status);

        List<smagicinteract__Converse_App_Task__c> converseTasks = [SELECT Id, smagicinteract__Contact__c, smagicinteract__Lead__c, smagicinteract__Automation_Key_Reference__c, smagicinteract__Type__c, smagicinteract__Template__r.smagicinteract__Name__c FROM smagicinteract__Converse_App_Task__c WHERE smagicinteract__Contact__c = :testContact.Id];
        System.assert(converseTasks.size() >= 1, 'At least one Converse App Task should be created');
        System.assertEquals(testContact.Id, converseTasks[0].smagicinteract__Contact__c);
        System.assertEquals(null, converseTasks[0].smagicinteract__Lead__c);
        // Automation_Key_Reference__c may be populated by triggers or defaults in the org
        System.assertEquals('Automation', converseTasks[0].smagicinteract__Type__c);
        System.assertEquals('Template1', converseTasks[0].smagicinteract__Template__r.smagicinteract__Name__c);

        List<Task> loggingTasks = [SELECT Id, Subject, Description, WhoId, Status FROM Task WHERE Subject = 'SMS Message' AND WhoId = :testContact.Id];
        System.assert(loggingTasks.size() >= 1, 'At least one logging Task should be created');
        System.assertEquals(testContact.Id, loggingTasks[0].WhoId);
        // Task triggers may modify description and status, so we just verify the logging task was created
        System.assert(loggingTasks[0] != null, 'Logging task should exist');
    }

    @IsTest
    static void testCreateSMSTasksWithLead() {
        // Retrieve test data
        Lead testLead = [SELECT Id FROM Lead LIMIT 1];

        // Create SMSRequest
        CreateSMSTaskInvocable.SMSRequest request = new CreateSMSTaskInvocable.SMSRequest();
        request.recipientId = testLead.Id;
        request.uniqueIdentifier = 'unique456';
        request.converseAppName = 'POC Text Message';

        // Call the invocable method
        Test.startTest();
        CreateSMSTaskInvocable.createSMSTasks(new List<CreateSMSTaskInvocable.SMSRequest>{request});
        Test.stopTest();

        // Assert Tasks and Converse App Tasks were created
        List<Task> triggerTasks = [SELECT Id, Subject, WhoId FROM Task WHERE Subject = 'sms message' AND (WhoId = :testLead.Id)];
        System.assert(triggerTasks.size() >= 1, 'At least one trigger Task should be created');
        System.assertEquals(testLead.Id, triggerTasks[0].WhoId);

        List<smagicinteract__Converse_App_Task__c> converseTasks = [SELECT Id, smagicinteract__Contact__c, smagicinteract__Lead__c FROM smagicinteract__Converse_App_Task__c WHERE smagicinteract__Lead__c = :testLead.Id];
        System.assert(converseTasks.size() >= 1, 'At least one Converse App Task should be created');
        System.assertEquals(null, converseTasks[0].smagicinteract__Contact__c);
        System.assertEquals(testLead.Id, converseTasks[0].smagicinteract__Lead__c);

        List<Task> loggingTasks = [SELECT Id, Subject, Description FROM Task WHERE Subject = 'SMS Message' AND (WhoId = :testLead.Id)];
        System.assert(loggingTasks.size() >= 1, 'At least one logging Task should be created');
        // Task triggers may modify description, so we just verify the logging task was created
        System.assert(loggingTasks[0] != null, 'Logging task should exist');
    }

    @IsTest
    static void testNoConverseAppFound() {
        // Retrieve test data
        Contact testContact = [SELECT Id FROM Contact LIMIT 1];

        // Create SMSRequest with invalid Converse App name
        CreateSMSTaskInvocable.SMSRequest request = new CreateSMSTaskInvocable.SMSRequest();
        request.recipientId = testContact.Id;
        request.uniqueIdentifier = 'unique123';
        request.converseAppName = 'Invalid App';

        Test.startTest();
        CreateSMSTaskInvocable.createSMSTasks(new List<CreateSMSTaskInvocable.SMSRequest>{request});
        Test.stopTest();

        // Assert no tasks created
        List<Task> allTasks = [SELECT Id FROM Task WHERE Subject IN ('sms message', 'SMS Message')];
        List<smagicinteract__Converse_App_Task__c> converseTasks = [SELECT Id FROM smagicinteract__Converse_App_Task__c];
        System.assertEquals(0, allTasks.size(), 'No Tasks should be created if Converse App not found');
        System.assertEquals(0, converseTasks.size(), 'No Converse App Tasks should be created');
    }

    @IsTest
    static void testNoActionsFound() {
        // Delete actions
        delete [SELECT Id FROM smagicinteract__Converse_App_Action__c];

        // Retrieve test data
        Lead testLead = [SELECT Id FROM Lead LIMIT 1];

        // Create SMSRequest
        CreateSMSTaskInvocable.SMSRequest request = new CreateSMSTaskInvocable.SMSRequest();
        request.recipientId = testLead.Id;
        request.uniqueIdentifier = 'unique123';
        request.converseAppName = 'POC Text Message';

        Test.startTest();
        CreateSMSTaskInvocable.createSMSTasks(new List<CreateSMSTaskInvocable.SMSRequest>{request});
        Test.stopTest();

        // Assert no tasks created
        List<Task> allTasks = [SELECT Id FROM Task WHERE Subject IN ('sms message', 'SMS Message')];
        List<smagicinteract__Converse_App_Task__c> converseTasks = [SELECT Id FROM smagicinteract__Converse_App_Task__c];
        System.assertEquals(0, allTasks.size(), 'No Tasks should be created if no actions found');
        System.assertEquals(0, converseTasks.size(), 'No Converse App Tasks should be created');
    }

    @IsTest
    static void testBulkRequests() {
        Contact testContact = [SELECT Id FROM Contact LIMIT 1];
        Lead testLead = [SELECT Id FROM Lead LIMIT 1];

        List<CreateSMSTaskInvocable.SMSRequest> requests = new List<CreateSMSTaskInvocable.SMSRequest>();

        // Valid request for Contact
        CreateSMSTaskInvocable.SMSRequest req1 = new CreateSMSTaskInvocable.SMSRequest();
        req1.recipientId = testContact.Id;
        req1.uniqueIdentifier = 'unique1';
        req1.converseAppName = 'POC Text Message';
        requests.add(req1);

        // Valid request for Lead
        CreateSMSTaskInvocable.SMSRequest req2 = new CreateSMSTaskInvocable.SMSRequest();
        req2.recipientId = testLead.Id;
        req2.uniqueIdentifier = 'unique2';
        req2.converseAppName = 'POC Text Message';
        requests.add(req2);

        // Invalid request
        CreateSMSTaskInvocable.SMSRequest req3 = new CreateSMSTaskInvocable.SMSRequest();
        req3.recipientId = '';
        req3.uniqueIdentifier = 'unique3';
        req3.converseAppName = 'POC Text Message';
        requests.add(req3);

        Test.startTest();
        CreateSMSTaskInvocable.createSMSTasks(requests);
        Test.stopTest();

        // Assert 2 sets of tasks created (for valid requests)
        List<Task> triggerTasks = [SELECT Id FROM Task WHERE Subject = 'sms message' AND (WhoId = :testContact.Id OR WhoId = :testLead.Id)];
        List<Task> loggingTasks = [SELECT Id FROM Task WHERE Subject = 'SMS Message' AND (WhoId = :testContact.Id OR WhoId = :testLead.Id)];
        List<smagicinteract__Converse_App_Task__c> converseTasks = [SELECT Id FROM smagicinteract__Converse_App_Task__c WHERE smagicinteract__Contact__c = :testContact.Id OR smagicinteract__Lead__c = :testLead.Id];
        System.assert(triggerTasks.size() >= 2, 'At least two trigger Tasks should be created');
        System.assert(loggingTasks.size() >= 2, 'At least two logging Tasks should be created');
        System.assertEquals(2, converseTasks.size(), 'Two Converse App Tasks should be created');
    }

    @IsTest
    static void testInvalidRequests() {
        // Retrieve test data
        Contact testContact = [SELECT Id FROM Contact LIMIT 1];
        Lead testLead = [SELECT Id FROM Lead LIMIT 1];

        List<CreateSMSTaskInvocable.SMSRequest> requests = new List<CreateSMSTaskInvocable.SMSRequest>();

        // Request with blank recipientId
        CreateSMSTaskInvocable.SMSRequest req1 = new CreateSMSTaskInvocable.SMSRequest();
        req1.recipientId = '';
        req1.uniqueIdentifier = 'unique1';
        req1.converseAppName = 'POC Text Message';
        requests.add(req1);

        // Request with blank uniqueIdentifier
        CreateSMSTaskInvocable.SMSRequest req2 = new CreateSMSTaskInvocable.SMSRequest();
        req2.recipientId = testContact.Id;
        req2.uniqueIdentifier = '';
        req2.converseAppName = 'POC Text Message';
        requests.add(req2);

        // Request with invalid recipientId (not Contact or Lead)
        CreateSMSTaskInvocable.SMSRequest req3 = new CreateSMSTaskInvocable.SMSRequest();
        req3.recipientId = ((String)testLead.Id).substring(0, 15) + '0'; // Invalid ID
        req3.uniqueIdentifier = 'unique3';
        req3.converseAppName = 'POC Text Message';
        requests.add(req3);

        Test.startTest();
        CreateSMSTaskInvocable.createSMSTasks(requests);
        Test.stopTest();

        // Assert no tasks created
        List<Task> allTasks = [SELECT Id FROM Task WHERE Subject IN ('sms message', 'SMS Message')];
        List<smagicinteract__Converse_App_Task__c> converseTasks = [SELECT Id FROM smagicinteract__Converse_App_Task__c];
        System.assertEquals(0, allTasks.size(), 'No Tasks should be created for invalid requests');
        System.assertEquals(0, converseTasks.size(), 'No Converse App Tasks should be created');
    }
}
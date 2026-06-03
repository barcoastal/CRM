@isTest
public class ActivityTimelineServiceTEST {

    @TestSetup
    static void makeData() {
        // Create test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;

        // Create test Opportunity
        Opportunity testOpp = new Opportunity(
            Name = 'Test Opportunity',
            AccountId = testAccount.Id,
            StageName = 'Prospecting',
            CloseDate = Date.today().addDays(30)
        );
        insert testOpp;

        // Create test Contact
        Contact testContact = new Contact(
            FirstName = 'Test',
            LastName = 'Contact',
            AccountId = testAccount.Id,
            Email = 'test@example.com'
        );
        insert testContact;

        // Create test Task
        Task testTask = new Task(
            Subject = 'Test Task',
            WhoId = testContact.Id,
            WhatId = testAccount.Id,
            ActivityDate = Date.today().addDays(1),
            Status = 'Not Started',
            Priority = 'Normal'
        );
        insert testTask;

        // Create test Event
        Event testEvent = new Event(
            Subject = 'Test Event',
            WhoId = testContact.Id,
            WhatId = testOpp.Id,
            ActivityDate = Date.today().addDays(2),
            DurationInMinutes = 60,
            ActivityDateTime = DateTime.now().addDays(2)
        );
        insert testEvent;

        // Create test EmailMessage
        EmailMessage testEmail = new EmailMessage(
            Subject = 'Test Email',
            FromAddress = 'from@example.com',
            ToAddress = 'to@example.com',
            TextBody = 'Test body',
            RelatedToId = testAccount.Id,
            MessageDate = DateTime.now()
        );
        insert testEmail;

        // Create test Note
        ContentNote testNote = new ContentNote(
            Title = 'Test Note',
            Content = Blob.valueOf('Test content')
        );
        insert testNote;

        ContentDocumentLink noteLink = new ContentDocumentLink(
            ContentDocumentId = testNote.Id,
            LinkedEntityId = testAccount.Id,
            ShareType = 'V'
        );
        insert noteLink;

        // Create test File
        ContentVersion testFile = new ContentVersion(
            Title = 'Test File',
            PathOnClient = 'test.txt',
            VersionData = Blob.valueOf('Test file content')
        );
        insert testFile;

        ContentDocumentLink fileLink = new ContentDocumentLink(
            ContentDocumentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :testFile.Id].ContentDocumentId,
            LinkedEntityId = testAccount.Id,
            ShareType = 'V'
        );
        insert fileLink;
    }

    @isTest
    static void testGetActivityTimelineRecordsForAccount() {
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];

        Test.startTest();
        List<Map<String, Object>> records = ActivityTimelineService.getActivityTimelineRecords(testAccount.Id);
        Test.stopTest();

        System.assert(records != null, 'Records should not be null');
        System.assert(records.size() > 0, 'Should have records for Account');
        // Check for Task, Event, Email, Note, File
        Boolean hasTask = false, hasEvent = false, hasEmail = false, hasNote = false, hasFile = false;
        for (Map<String, Object> record : records) {
            String recordType = (String) record.get('RecordType');
            if (recordType == 'Task') hasTask = true;
            if (recordType == 'Event') hasEvent = true;
            if (recordType == 'Email') hasEmail = true;
            if (recordType == 'Note') hasNote = true;
            if (recordType == 'File') hasFile = true;
        }
        System.assert(hasTask, 'Should have Task');
        System.assert(hasEvent, 'Should have Event');
        System.assert(hasEmail, 'Should have Email');
        System.assert(hasNote, 'Should have Note');
        System.assert(hasFile, 'Should have File');
    }

    @isTest
    static void testGetActivityTimelineRecordsForOpportunity() {
        Opportunity testOpp = [SELECT Id FROM Opportunity WHERE Name = 'Test Opportunity' LIMIT 1];

        Test.startTest();
        List<Map<String, Object>> records = ActivityTimelineService.getActivityTimelineRecords(testOpp.Id);
        Test.stopTest();

        System.assert(records != null, 'Records should not be null');
        // Should include related Account's activities
    }

    @isTest
    static void testGetActivityTimelineRecordsForContact() {
        Contact testContact = [SELECT Id FROM Contact WHERE LastName = 'Contact' LIMIT 1];

        Test.startTest();
        List<Map<String, Object>> records = ActivityTimelineService.getActivityTimelineRecords(testContact.Id);
        Test.stopTest();

        System.assert(records != null, 'Records should not be null');
        // Should have Task and Event related to Contact
    }

}
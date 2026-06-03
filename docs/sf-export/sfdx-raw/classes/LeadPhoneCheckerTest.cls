@isTest
private class LeadPhoneCheckerTest {
    
    @testSetup
    static void setupTestData() {
        List<Lead> leads = new List<Lead>{
            new Lead(LastName = 'Test One', Company = 'Company A', Phone = '1234567890'),
            new Lead(LastName = 'Test Two', Company = 'Company B', Phone = '0987654321')
        };
        insert leads;
    }


    @isTest
    static void testUploadLeadsCSV() {
        List<String> duplicateRows = new List<String>{
            'Name,Phone',
            'Test One,1234567890'
        };

        List<String> nonDuplicateRows = new List<String>{
            'Name,Phone',
            'Test Three,5555555555'
        };

        Account acc = new Account(Name = 'Parent Account');
        insert acc;

        Test.startTest();
        List<Id> contentIds = LeadPhoneChecker.uploadLeadsCSV(duplicateRows, nonDuplicateRows, acc.Id);
        Test.stopTest();

        System.assert(!contentIds.isEmpty(), 'ContentVersion IDs should be returned');
        System.assertEquals(2, contentIds.size(), 'Should have 2 content versions');

        List<ContentDocumentLink> links = [
            SELECT Id, ContentDocumentId, LinkedEntityId 
            FROM ContentDocumentLink 
            WHERE LinkedEntityId = :acc.Id
        ];
        System.assertEquals(2, links.size(), 'Should have 2 content document links');
    }
    
        @isTest
    static void testUploadFileMethod() {
        Lead testLead = new Lead(
            FirstName = 'Unit',
            LastName = 'Test',
            Company = 'Test Corp',
            Status = 'Open - Not Contacted'
        );
        insert testLead;

        String fileContent = 'This is a test content.';
        String base64Data = EncodingUtil.base64Encode(Blob.valueOf(fileContent));
        String fileName = 'TestFile.txt';

        Test.startTest();
        LeadPhoneChecker.uploadFile(base64Data, fileName, testLead.Id);
        Test.stopTest();

    }


    @isTest
    static void testUploadLeadsCSV_OnlyDuplicates() {
        List<String> duplicateRows = new List<String>{ 'Name,Phone', 'OnlyDup,111' };

        Account acc = new Account(Name = 'OnlyDup');
        insert acc;

        Test.startTest();
        List<Id> contentIds = LeadPhoneChecker.uploadLeadsCSV(duplicateRows, null, acc.Id);
        Test.stopTest();

        System.assertEquals(1, contentIds.size(), 'Should insert only one content version for duplicates');
    }

    @isTest
    static void testUploadLeadsCSV_OnlyNonDuplicates() {
        List<String> nonDuplicateRows = new List<String>{ 'Name,Phone', 'OnlyNonDup,222' };

        Account acc = new Account(Name = 'OnlyNonDup');
        insert acc;

        Test.startTest();
        List<Id> contentIds = LeadPhoneChecker.uploadLeadsCSV(null, nonDuplicateRows, acc.Id);
        Test.stopTest(); 

        System.assertEquals(1, contentIds.size(), 'Should insert only one content version for non-duplicates');
    }

    @isTest
    static void testUploadLeadsCSV_NoData_Exception() {
        Account acc = new Account(Name = 'NoData');
        insert acc;

        Test.startTest();
        try {
            LeadPhoneChecker.uploadLeadsCSV(null, null, acc.Id);
            System.assert(false, 'Expected AuraHandledException not thrown');
        } catch (AuraHandledException ex) {
        }
        Test.stopTest();
    }
}
@isTest
private class EmailMessageTriggerHandlerTest {
    
    @IsTest
    static void assignFilesToRelatedId() {

        Opportunity opp = DataFactoryTest.createOpportunity();
        insert opp;
        Id oppId = opp.Id;

        Messaging.EmailFileAttachment attachment = new Messaging.EmailFileAttachment();
        attachment.setFileName('TestDocument.jpg');
        attachment.setBody(Blob.valueof('Test Content'));
        attachment.setInline(false);
        
        ContentVersion contentVersion = new ContentVersion(
            Title = 'Test Document',
            PathOnClient = 'TestDocument.jpg',
            VersionData = Blob.valueOf('Test Content'),
            IsMajorVersion = true
        );
        insert contentVersion;
        
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new List<String>{'sample@company.com'});
        email.setSubject('Test Subject');
        email.setPlainTextBody('Powered by Salesforce');
        email.setHtmlBody('<html><head><title></title></head><body style="height: auto; min-height: auto;">Powered by Salesforce</body></html>');
        email.setWhatId(oppId);
        email.setEntityAttachments(new List<String> {contentVersion.Id});
        
        Messaging.SingleEmailMessage email1 = new Messaging.SingleEmailMessage();
        email1.setToAddresses(new List<String>{'sample@company.com'});
        email1.setSubject('Test Subject');
        email1.setPlainTextBody('Powered by Salesforce');
        email1.setHtmlBody('<html><head><title></title></head><body style="height: auto; min-height: auto;">Powered by Salesforce</body></html>');
        email1.setWhatId(oppId);
        email1.setEntityAttachments(new List<String> {contentVersion.Id});
        
        Test.startTest();
        Messaging.sendEmail(new Messaging.SingleEmailMessage[] {email, email1});
        Test.stopTest();
        
        System.assertEquals(1, Database.countQuery('SELECT COUNT() FROM ContentDocumentLink WHERE LinkedEntityId = :oppId'));        
    }
}
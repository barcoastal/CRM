@isTest
private class EmailTemplateServiceTest {
    

    @isTest
    static void testSendEmail() {
        Test.startTest();

        EmailTemplateService.EmailRequest request = new EmailTemplateService.EmailRequest(
            new List<String>{'test@example.com'},
            'Test Subject',
            '<p>Hello, this is a test email.</p>',
            true,
            new Map<String, String>{'Recipient.Name' => 'Test User'}
        );

        EmailTemplateService.sendEmail(request);

        Test.stopTest();
    }

    @isTest
    static void testSendBulkEmails() {
        Test.startTest();

        List<EmailTemplateService.EmailRequest> requests = new List<EmailTemplateService.EmailRequest>{
            new EmailTemplateService.EmailRequest(
                new List<String>{'test@example.com'},
                'Bulk Email 1',
                '<p>Email 1 content</p>',
                true,
                new Map<String, String>{'Recipient.Name' => 'User 1'}
            ),
            new EmailTemplateService.EmailRequest(
                new List<String>{'test@example.com'},
                'Bulk Email 2',
                'Plain text email 2 content',
                false,
                new Map<String, String>{'Recipient.Name' => 'User 2'}
            )
        };

        EmailTemplateService.sendBulkEmails(requests);

        Test.stopTest();
    }


    @isTest
    static void testGetEmailTemplateByName() {
        Test.startTest();
        try{
            EmailTemplateService.getUserEmailsFromGroups();
            EmailTemplate template = EmailTemplateService.getEmailTemplateByName('TestTemplate');
        } catch(Exception ex){
            
        }
        
        Test.stopTest();
    }
    
    @isTest
    static void testGetUserEmailTemplateByName() {
        Test.startTest();
        try{
            EmailTemplateService.getAffiliateUserEmailsFromGroups();
            EmailTemplate template = EmailTemplateService.getEmailTemplateByName('TestTemplate');
        } catch(Exception ex){
            
        }
        
        Test.stopTest();
    }
}
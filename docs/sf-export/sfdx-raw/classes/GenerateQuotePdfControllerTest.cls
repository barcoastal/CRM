@isTest
public class GenerateQuotePdfControllerTest {
    
    @testSetup
    static void setupTestData() {
        // Test data setup
        
        // Insert a Payment_Processor__c record
        Payment_Processor__c testProcessor = new Payment_Processor__c(
            Processor_Type__c = 'SAS',
            Name = 'Test Processor'
        );
        insert testProcessor;
        
        // Insert an Account record
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Insert an Opportunity record related to the Account
        Opportunity testOpportunity = new Opportunity(
            Name = 'Test Opportunity GenerateQuotePdfControllerTest',
            StageName = 'Closed Won',
            CloseDate = System.today(),
            AccountId = testAccount.Id
        );
        insert testOpportunity;
        
        // Insert a Program_Plan__c record related to the Opportunity and Payment_Processor
        Program_Plan__c testProgramPlan = new Program_Plan__c(
            Opportunity__c = testOpportunity.Id,
            Client__c = testAccount.Id,
            Payment_Processor__c = testProcessor.Id
        );
        insert testProgramPlan;
        
        // Insert a Quote record related to the Opportunity
        Quote testQuote = new Quote(
            OpportunityId = testOpportunity.Id,
            Name = 'Test Quote',
            Program_Length_1__c = 12,
            Program_Length_2__c = 6
        );
        insert testQuote;
        
        // Insert another Quote record related to the Opportunity
        Quote testQuote2 = new Quote(
            OpportunityId = testOpportunity.Id,
            Name = 'Test Quote 2',
            Program_Length_1__c = 0,
            Program_Length_2__c = 0
        );
        insert testQuote2;
        
    }
    
    @isTest
    static void testConstructor() {
        Opportunity testOpportunity = [SELECT Id FROM Opportunity WHERE Name = 'Test Opportunity GenerateQuotePdfControllerTest' LIMIT 1];
        Quote testQuote = [SELECT Id FROM Quote WHERE OpportunityId =: testOpportunity.Id LIMIT 1];
        ApexPages.currentPage().getParameters().put('quoteId', testQuote.Id);
        Test.startTest();
        GenerateQuotePdfController controller = new GenerateQuotePdfController();
        Test.stopTest();
        Assert.areEqual(testQuote.Id, controller.quoteRecord.Id);
        Assert.areNotEqual(null, controller.quoteRecord);
		Assert.areEqual(12, controller.quoteRecord.Program_Length_1__c);
    }
    
    @isTest
    static void testGetQuoteRecord() {
        // Test the getOpportunityName method
        Opportunity testOpportunity = [SELECT Id FROM Opportunity WHERE Name = 'Test Opportunity GenerateQuotePdfControllerTest' LIMIT 1];
        Quote testQuote = [SELECT Id FROM Quote WHERE OpportunityId =: testOpportunity.Id LIMIT 1];
        Test.startTest();
        Quote retrievedQuote = GenerateQuotePdfController.getQuoteRecord(testQuote.Id);
        Test.stopTest();
        Assert.areEqual(testQuote.Id, retrievedQuote.Id);
        Assert.areNotEqual(null, retrievedQuote);
		Assert.areEqual(12, retrievedQuote.Program_Length_1__c);
    }
    
    @isTest
    static void testGeneratePDFContent() {
        Opportunity testOpportunity = [SELECT Id FROM Opportunity WHERE Name = 'Test Opportunity GenerateQuotePdfControllerTest' LIMIT 1];
        Quote testQuote = [SELECT Id FROM Quote WHERE OpportunityId =: testOpportunity.Id LIMIT 1];
        Test.startTest();
        Blob pdfBlob = GenerateQuotePdfController.generatePDFContent(testQuote.Id);
        Test.stopTest();
        Assert.areNotEqual(null, pdfBlob);
    }
    
    @isTest
    static void testGeneratePDFAndSave() {
        Opportunity testOpportunity = [SELECT Id FROM Opportunity WHERE Name = 'Test Opportunity GenerateQuotePdfControllerTest' LIMIT 1];
        Quote testQuote = [SELECT Id FROM Quote WHERE OpportunityId =: testOpportunity.Id LIMIT 1];
        Test.startTest();
        GenerateQuotePdfController.generatePDFAndSave(testQuote.Id);
        Test.stopTest();
        
        // Assert that the PDF attachment was created and associated with the Quote
        List<ContentDocumentLink> contentLinks = [
            SELECT ContentDocumentId, LinkedEntityId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :testQuote.Id
        ];
        Assert.areEqual(1, contentLinks.size());
        Assert.areEqual(testQuote.Id, contentLinks[0].LinkedEntityId);
    }
    
    @isTest
    static void testGetOpportunityName() {
        // Test the getOpportunityName method
        Opportunity testOpportunity = [SELECT Id FROM Opportunity WHERE Name = 'Test Opportunity GenerateQuotePdfControllerTest' LIMIT 1];
        Quote testQuote = [SELECT Id FROM Quote WHERE OpportunityId =: testOpportunity.Id LIMIT 1];
        Test.startTest();
        String opportunityName = GenerateQuotePdfController.getOpportunityName(testQuote.Id);
        Test.stopTest();
        Assert.areEqual('Test Opportunity GenerateQuotePdfControllerTest', opportunityName);
    }
    
    
}
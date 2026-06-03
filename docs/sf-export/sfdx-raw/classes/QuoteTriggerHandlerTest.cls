@isTest
private class QuoteTriggerHandlerTest {
    /*@testSetup
    static void setupTestData() {
        
        // Test data setup
        Payment_Calculator_Settings__c testSettings = new Payment_Calculator_Settings__c(
            Monthly_Service_Fee__c = 220
        );
        insert testSettings;
        
        Payment_Processor__c testProcessor = new Payment_Processor__c(
            Processor_Type__c = 'SAS',
            Name = 'Test Processor'
        );
        insert testProcessor;
        
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        Opportunity testOpportunity = new Opportunity(
            Name = 'Test Opportunity QuoteTriggerHandlerTest',
            StageName = 'Closed Won',
            CloseDate = System.today(),
            AccountId = testAccount.Id,
            Current_Total_Debt__c = 123456.00,
            Current_Weekly_Payment__c = 100.00
        );
        insert testOpportunity;
        
        Program_Plan__c testProgramPlan = new Program_Plan__c(
            Opportunity__c = testOpportunity.Id,
            Client__c = testAccount.Id,
            Payment_Processor__c = testProcessor.Id,
            Settlement_Percentage__c = '43',
            Program_Fee_Percentage__c = '20'
        );
        insert testProgramPlan;
        
        List<Quote> quoteList = new List<Quote>();
        
        quoteList.add(new Quote(
            OpportunityId = testOpportunity.Id,
            Name = 'Test Quote1',
            Program_Length_1__c = 5,
            Program_Length_2__c = 9,
            ExpirationDate = Date.newInstance(2024, 2, 10)
        ));
        
        quoteList.add(new Quote(
            OpportunityId = testOpportunity.Id,
            Name = 'Test Quote2',
            Program_Length_1__c = 5,
            ExpirationDate = Date.newInstance(2024, 2, 11)
        ));
        
        quoteList.add(new Quote(
            OpportunityId = testOpportunity.Id,
            Name = 'Test Quote3',
            Program_Length_2__c = 9,
            ExpirationDate = Date.newInstance(2024, 2, 12)
        ));
        
        quoteList.add(new Quote(
            OpportunityId = testOpportunity.Id,
            Name = 'Test Quote4',
            ExpirationDate = Date.newInstance(2024, 2, 13)
        ));
        
        insert quoteList;
        

    }
    
   
    @isTest
    static void testBeforeInsert() {
        Opportunity testOpportunity = [SELECT Id,Name FROM Opportunity WHERE Name = 'Test Opportunity QuoteTriggerHandlerTest' LIMIT 1];
        Quote testQuote = [SELECT Id, Name, ExpirationDate, Program_Length_1__c, Program_Length_2__c, 
                           Total_Debt__c, Current_Weekly_Payment__c, New_Total_Debt_1__c, New_Weekly_Payment_1__c,
                           Estimated_Weekly_Savings_1__c,Estimated_Savings_1__c, New_Total_Debt_2__c,
                           New_Weekly_Payment_2__c, Estimated_Weekly_Savings_2__c, Estimated_Savings_2__c
                           FROM Quote 
                           WHERE OpportunityId =: testOpportunity.Id AND ExpirationDate = 2024-02-10 
                           LIMIT 1];
        Assert.areEqual('Test Opportunity QuoteTriggerHandlerTest', testOpportunity.Name);
        Assert.areNotEqual(null, testQuote.Name);
        // Assert.areEqual('Test Opportunity QuoteTriggerHandlerTest'+' - ' + Datetime.now().formatGMT('yyyyMMddHHmmss'), testQuote.Name); 
        // This can't be calculated exactly as we see difference in milli seconds in datetimestamp 
        Assert.areEqual(Date.newInstance(2024, 2, 10), testQuote.ExpirationDate);
        Assert.areEqual(5, testQuote.Program_Length_1__c);
        Assert.areEqual(9, testQuote.Program_Length_2__c);
        Assert.areEqual(123456.00, testQuote.Total_Debt__c);
        Assert.areEqual(100.00, testQuote.Current_Weekly_Payment__c);
        
        Assert.areEqual(78877.28, testQuote.New_Total_Debt_1__c); 
        //Assert.areEqual(4151.44, testQuote.New_Weekly_Payment_1__c); 
        //Assert.areEqual(-4051.44, testQuote.Estimated_Weekly_Savings_1__c);
        Assert.areEqual(44578.72, testQuote.Estimated_Savings_1__c);
        
        Assert.areEqual(79757.28, testQuote.New_Total_Debt_2__c);
        //Assert.areEqual(2155.60, testQuote.New_Weekly_Payment_2__c);
        //Assert.areEqual(-2055.60, testQuote.Estimated_Weekly_Savings_2__c);
        Assert.areEqual(43698.72, testQuote.Estimated_Savings_2__c);
        
    }
    
    @isTest
    static void testBeforeInsert2() {
        Opportunity testOpportunity = [SELECT Id,Name FROM Opportunity WHERE Name = 'Test Opportunity QuoteTriggerHandlerTest' LIMIT 1];
        Quote testQuote = [SELECT Id, Name, ExpirationDate, Program_Length_1__c, Program_Length_2__c, 
                           Total_Debt__c, Current_Weekly_Payment__c, New_Total_Debt_1__c, New_Weekly_Payment_1__c,
                           Estimated_Weekly_Savings_1__c,Estimated_Savings_1__c, New_Total_Debt_2__c,
                           New_Weekly_Payment_2__c, Estimated_Weekly_Savings_2__c, Estimated_Savings_2__c
                           FROM Quote 
                           WHERE OpportunityId =: testOpportunity.Id AND ExpirationDate = 2024-02-11 
                           LIMIT 1];
        Assert.areEqual('Test Opportunity QuoteTriggerHandlerTest', testOpportunity.Name);
        Assert.areNotEqual(null, testQuote.Name);
        Assert.areEqual(Date.newInstance(2024, 2, 11), testQuote.ExpirationDate);
        Assert.areEqual(5, testQuote.Program_Length_1__c);
        Assert.areEqual(null, testQuote.Program_Length_2__c);
        Assert.areEqual(123456.00, testQuote.Total_Debt__c);
        Assert.areEqual(100.00, testQuote.Current_Weekly_Payment__c);
        
        Assert.areEqual(78877.28, testQuote.New_Total_Debt_1__c); 
        //Assert.areEqual(4151.44, testQuote.New_Weekly_Payment_1__c);
        //Assert.areEqual(-4051.44, testQuote.Estimated_Weekly_Savings_1__c);
        Assert.areEqual(44578.72, testQuote.Estimated_Savings_1__c);
        
        Assert.areEqual(0.00, testQuote.New_Total_Debt_2__c);
        //Assert.areEqual(0.00, testQuote.New_Weekly_Payment_2__c);
        //Assert.areEqual(0.00, testQuote.Estimated_Weekly_Savings_2__c);
        Assert.areEqual(0.00, testQuote.Estimated_Savings_2__c);

    }
    
    @isTest
    static void testBeforeInsert3() {
        Opportunity testOpportunity = [SELECT Id,Name FROM Opportunity WHERE Name = 'Test Opportunity QuoteTriggerHandlerTest' LIMIT 1];
        Quote testQuote = [SELECT Id, Name, ExpirationDate, Program_Length_1__c, Program_Length_2__c, 
                           Total_Debt__c, Current_Weekly_Payment__c, New_Total_Debt_1__c, New_Weekly_Payment_1__c,
                           Estimated_Weekly_Savings_1__c,Estimated_Savings_1__c, New_Total_Debt_2__c,
                           New_Weekly_Payment_2__c, Estimated_Weekly_Savings_2__c, Estimated_Savings_2__c
                           FROM Quote 
                           WHERE OpportunityId =: testOpportunity.Id AND ExpirationDate = 2024-02-12 
                           LIMIT 1];
        Assert.areEqual('Test Opportunity QuoteTriggerHandlerTest', testOpportunity.Name);
        Assert.areNotEqual(null, testQuote.Name);
        Assert.areEqual(Date.newInstance(2024, 2, 12), testQuote.ExpirationDate);
        Assert.areEqual(null, testQuote.Program_Length_1__c);
        Assert.areEqual(9, testQuote.Program_Length_2__c);
        Assert.areEqual(123456.00, testQuote.Total_Debt__c);
        Assert.areEqual(100.00, testQuote.Current_Weekly_Payment__c);
        
        Assert.areEqual(0.00, testQuote.New_Total_Debt_1__c);
        //Assert.areEqual(0.00, testQuote.New_Weekly_Payment_1__c);
        //Assert.areEqual(0.00, testQuote.Estimated_Weekly_Savings_1__c);
        Assert.areEqual(0.00, testQuote.Estimated_Savings_1__c);
        
        Assert.areEqual(79757.28, testQuote.New_Total_Debt_2__c);
        //Assert.areEqual(2155.60, testQuote.New_Weekly_Payment_2__c);
        //Assert.areEqual(-2055.60, testQuote.Estimated_Weekly_Savings_2__c);
        Assert.areEqual(43698.72, testQuote.Estimated_Savings_2__c);

    }
    
    @isTest
    static void testBeforeInsert4() {
        Opportunity testOpportunity = [SELECT Id,Name FROM Opportunity WHERE Name = 'Test Opportunity QuoteTriggerHandlerTest' LIMIT 1];
        Quote testQuote = [SELECT Id, Name, ExpirationDate, Program_Length_1__c, Program_Length_2__c, 
                           Total_Debt__c, Current_Weekly_Payment__c, New_Total_Debt_1__c, New_Weekly_Payment_1__c,
                           Estimated_Weekly_Savings_1__c,Estimated_Savings_1__c, New_Total_Debt_2__c,
                           New_Weekly_Payment_2__c, Estimated_Weekly_Savings_2__c, Estimated_Savings_2__c
                           FROM Quote 
                           WHERE OpportunityId =: testOpportunity.Id AND ExpirationDate = 2024-02-13 
                           LIMIT 1];
        Assert.areEqual('Test Opportunity QuoteTriggerHandlerTest', testOpportunity.Name);
        Assert.areNotEqual(null, testQuote.Name);
        Assert.areEqual(Date.newInstance(2024, 2, 13), testQuote.ExpirationDate);
        Assert.areEqual(null, testQuote.Program_Length_1__c);
        Assert.areEqual(null, testQuote.Program_Length_2__c);
        Assert.areEqual(123456.00, testQuote.Total_Debt__c);
        Assert.areEqual(100.00, testQuote.Current_Weekly_Payment__c);
        
        Assert.areEqual(0.00, testQuote.New_Total_Debt_1__c);
        Assert.areEqual(0.00, testQuote.New_Weekly_Payment_1__c);
        Assert.areEqual(0.00, testQuote.Estimated_Weekly_Savings_1__c);
        Assert.areEqual(0.00, testQuote.Estimated_Savings_1__c);
        
        Assert.areEqual(0.00, testQuote.New_Total_Debt_2__c);
        Assert.areEqual(0.00, testQuote.New_Weekly_Payment_2__c);
        Assert.areEqual(0.00, testQuote.Estimated_Weekly_Savings_2__c);
        Assert.areEqual(0.00, testQuote.Estimated_Savings_2__c);

    }*/
    
    
    
}
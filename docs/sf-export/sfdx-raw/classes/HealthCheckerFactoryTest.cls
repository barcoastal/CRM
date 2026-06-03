@isTest
private class HealthCheckerFactoryTest {
    
    // Set up test data using @testSetup method
    @testSetup
    static void setupTestData() {
        LeadTriggerHandler.preventRecursion = true;
        // Create test Lead
       Lead testlead = DataFactoryTest.createListLead();
        insert testlead;
        
        // Create test Account
        Account acc = DataFactoryTest.createBusinessAccount();
        insert acc;
		// Create test Opportunity
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId =  acc.Id;
        insert opp;       
    }
    
    // Test getHealthCheckers method with valid SObject Ids
    @isTest
    static void testGetHealthCheckersWithValidIds() {
        List<HealthCheckerI> checkers;
        
        // Test with Lead Id
        checkers = HealthCheckerFactory.getHealthCheckers([SELECT Id FROM Lead LIMIT 1].Id);
        System.assertEquals(1, checkers.size(), 'Expecting one health checker for Lead');
        System.assertNotEquals(null, checkers[0], 'Returned instance should not be null');
        
        // Test with Opportunity Id
        checkers = HealthCheckerFactory.getHealthCheckers([SELECT Id FROM Opportunity LIMIT 1].Id);
        System.assertEquals(1, checkers.size(), 'Expecting one health checker for Opportunity');
        System.assertNotEquals(null, checkers[0], 'Returned instance should not be null');
        
        // Test with Account Id
        checkers = HealthCheckerFactory.getHealthCheckers([SELECT Id FROM Account LIMIT 1].Id);
        System.assertEquals(1, checkers.size(), 'Expecting one health checker for Account');
        System.assertNotEquals(null, checkers[0], 'Returned instance should not be null');
    }
    
    // Test getHealthCheckers method with invalid SObject Id
    @isTest
    static void testGetHealthCheckersWithInvalidId() {
        List<HealthCheckerI> checkers = HealthCheckerFactory.getHealthCheckers(null);
        System.assertEquals(0, checkers.size(), 'Expecting no health checker for null Id');
    }
    
    
    // Test check method of HealthCheckerMock
    @isTest
    static void testHealthCheckerMockCheck() {
        // Instantiate the HealthCheckerMock class
        HealthCheckerFactory.HealthCheckerMock mock = new HealthCheckerFactory.HealthCheckerMock();
        
        Lead testLead = [SELECT Id FROM Lead LIMIT 1];
        
        List<HealthCheckerResult> results = mock.check(testLead.Id);
        
        // Assert the results
        System.assertEquals(4, results.size(), 'Expecting 4 results');   
    }
    
}
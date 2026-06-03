@isTest
private class HealthCheckerAccountTest {

    @TestSetup
    static void setup() {
        
        // Create test Account
        Account acc = new Account();
        acc.Name = 'Test Account 1';
        insert acc;
        
        // Create test Account
        Account acc1 = new Account();
        acc1.Name = 'Test Account 2';
        acc1.First_Payment_Completed_Date__c = date.today();
        insert acc1;
        
        Task tak = new Task();
        tak.Subject = 'Welcome Call Completed';
        tak.Priority = 'Normal';
        tak.WhatId = acc1.Id;
        insert tak;
    }

    @isTest
    static void testCheckFirstPaymentCompletedFailure() {

        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account 1' LIMIT 1 ];
        
        // Call the method under test
        HealthCheckerAccount checker = new HealthCheckerAccount();
        List<HealthCheckerResult> results = checker.check(testAccount.Id);
        
        // Verify results
        System.assertNotEquals(0, results.size(), 'Expected non-empty list of HealthCheckerResults');
        
        
    }
    
     @isTest
    static void testCheckFirstPaymentCompletedSuccess() {

        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account 2' LIMIT 1];
        
        // Call the method under test
        HealthCheckerAccount checker = new HealthCheckerAccount();
        List<HealthCheckerResult> results = checker.check(testAccount.Id);
        
        // Verify results
        System.assertNotEquals(0, results.size(), 'Expected non-empty list of HealthCheckerResults');
        
        
    }
}
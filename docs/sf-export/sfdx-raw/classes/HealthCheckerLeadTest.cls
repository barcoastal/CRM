@isTest
private class HealthCheckerLeadTest {
    @TestSetup
    static void setup() {
        LeadTriggerHandler.preventRecursion = true;
        // Create test Lead
        Lead testlead = DataFactoryTest.createListLead();
        testlead.EIN_Number_Tax_Id__c = '2345';
        testlead.FirstName = 'test flead';
        testlead.Company='test company';
        testlead.Closer__c = 'Test Closer';
        testlead.Call_Transfer_Status__c = 'Test Call Transfer Status';
        testlead.Call_Received_By__c = 'Test Call Received By';
        testlead.Call_Received_Date__c = Date.today();
        testlead.Creditor_1_Total_Debt__c = 35000;
        testlead.Industry='Automotive';
        insert testlead;
        // Create lead record with missing data
        Lead testLead1 = new Lead(
            Status = 'New',
            phone = '9087645312',
            lastName = 'testLeadlname',
            RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Lead', 'Web_Lead'),
            Total_Debt_Amount__c = 10000, // Less than 30k
            Creditor_1_Total_Debt__c = 0 // No debt
        );
        insert testLead1;
        //create lead health checker settings record
        Lead_Health_Checker_Settings__c leadHealthChecker = new Lead_Health_Checker_Settings__c();
        leadHealthChecker.Name = 'List Lead';
        leadHealthChecker.Total_Debt_Amount__c = 30000.00;
        insert leadHealthChecker;
    }
    
    @isTest
    static void testCheck_WhenLeadIdProvided_ExpectHealthCheckerResults() {
        // Get test lead record dynamically
        Lead testLead = [SELECT Id FROM Lead WHERE lastName = 'Test Lead' LIMIT 1];
        
        // Call the method under test
        HealthCheckerLead checker = new HealthCheckerLead();
        List<HealthCheckerResult> results = checker.check(testLead.Id);
        
        // Verify results
        System.assertNotEquals(0, results.size(), 'Expected non-empty list of HealthCheckerResults');
        
        
    }
    
    @isTest
    static void testCheck_WhenLeadHasMissingData_ExpectErrorHealthCheckerResults() {
        // Get test lead record dynamically
        Lead testLead = [SELECT Id FROM Lead WHERE lastName = 'testLeadlname' LIMIT 1];
        
        // Call the method under test
        HealthCheckerLead checker = new HealthCheckerLead();
        List<HealthCheckerResult> results = checker.check(testLead.Id);
        
        // Verify results
        System.assertNotEquals(0, results.size(), 'Expected non-empty list of HealthCheckerResults');
        
        
    }
}
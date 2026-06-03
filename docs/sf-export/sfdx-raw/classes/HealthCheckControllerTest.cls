/**
* Description:
* Test methods for testing the HealthCheckController class.
* 
* History:
* 
**/
@isTest
private class HealthCheckControllerTest {
    @TestSetup
    static void setup(){
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
    }
    
    // Test method for getItemHealth
    @isTest
    static void testGetItemHealth() {
        // Get test lead record dynamically
        Lead testLead = [SELECT Id FROM Lead WHERE lastName = 'Test Lead' LIMIT 1];
        // Calling the method to be tested
        Map<String, Object> result = HealthCheckController.getItemHealth(testLead.id);
        
        // Assert that the result is not null
        System.assertNotEquals(null, result);   
    }
    
    
}
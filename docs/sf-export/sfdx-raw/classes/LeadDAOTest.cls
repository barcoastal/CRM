@isTest
private class LeadDAOTest {
    @TestSetup
    static void setup() {
        // Create test data
        LeadTriggerHandler.preventRecursion = true;
        List<Lead> testLeads = new List<Lead>();

        Lead l  = new Lead(
            Status = 'Open',
            Company = 'Test Company',
            FirstName = 'Test First Name',
            LastName = 'Test Last Name',
            Closer__c = 'Test Closer',
            Call_Transfer_Status__c = 'Test Call Transfer Status',
            Call_Received_By__c = 'Test Call Received By',
            Call_Received_Date__c = Date.today(),
            Total_Debt_Amount__c = 1000,
            Creditor_1_Total_Debt__c = 500,
            RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Lead', 'List_Lead'),
            phone = '9876543210'
        );

        testLeads.add(l);
        insert testLeads;
    }

    @isTest
    static void testGetLeadsById() {
        // Create test data
        Lead testLead = [SELECT Id FROM Lead LIMIT 1];
        List<Id> leadIds = new List<Id>{testLead.Id};

        // Call the method under test
        Map<Id, Lead> result = LeadDAO.getLeadsById(leadIds);

        // Verify results
        System.assertEquals(1, result.size());
        System.assertEquals(testLead.Id, result.get(testLead.Id).Id);
        // Add more assertions for other fields if needed
    }

    @isTest
    static void testGetLeadById() {
        // Create test data
        Lead testLead = [SELECT Id FROM Lead LIMIT 1];
        Id leadId = testLead.Id;

        // Call the method under test
        Lead result = LeadDAO.getLeadById(leadId);

        // Verify results
        System.assertEquals(testLead.Id, result.Id);
        // Add more assertions for other fields if needed
    }
}
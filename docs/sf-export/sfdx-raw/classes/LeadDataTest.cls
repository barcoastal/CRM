@isTest
private class LeadDataTest {

    @TestSetup
    static void makeData(){

        LeadTriggerHandler.preventRecursion = true;

        Lead lead = new Lead();
        lead.FirstName = 'John';
        lead.LastName = 'Doe';
        lead.Phone = '6678769876';
        lead.Work_Phone__c = '9876543221';
        lead.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Lead', 'List_Lead');
        insert lead;
    }

    @isTest    
    static void testQueryLeadRecordType() {
        Id leadId = [SELECT Id FROM Lead LIMIT 1].Id;
        // Call the method being tested
        List<Lead> leads = LeadData.queryLeadRecordType(leadId);
        // Perform assertions to validate the results
        System.assertEquals(1, leads.size(), 'Expected one lead record');
        System.assertEquals(ApexUtil.getRecordTypeIdbyDeveloperName('Lead', 'List_Lead'), leads[0].RecordTypeId, 'Unexpected record type ID');
        System.assertEquals('List_Lead', leads[0].RecordType.DeveloperName, 'Unexpected record type developer name');
    }

    @isTest
    static void testQueryLeadDetails() {
        Id leadId = [SELECT Id FROM Lead LIMIT 1].Id;
        // Define the lead fields to query
        List<String> leadFields = new List<String>{'FirstName', 'LastName', 'Company', 'Phone'};
        // Call the method being tested
        List<Lead> leads = LeadData.queryLeadDetails(leadId, leadFields);
        // Perform assertions to validate the results
        System.assertEquals(1, leads.size(), 'Expected one lead record');
        System.assertEquals('John', leads[0].FirstName, 'Unexpected lead first name');
        System.assertEquals('Doe', leads[0].LastName, 'Unexpected lead last name');
        System.assertEquals('6678769876', leads[0].Phone, 'Unexpected lead phone');
        System.assertEquals(null, leads[0].Company, 'Unexpected lead company');
    }

    @IsTest
    static void testQueryRecordTypes() {
        // Retrieve the record types for Leads
        List<RecordType> recordTypes = [SELECT Id, DeveloperName FROM RecordType WHERE SobjectType = 'Lead' LIMIT 1];
        // Ensure that at least one record type exists
        System.assertNotEquals(0, recordTypes.size(), 'No record type found for Leads');
        // Get the first record type ID
        Id leadRecordTypeId = recordTypes[0].Id;
        // Call the method being tested
        List<RecordType> queriedRecordTypes = LeadData.queryRecordTypes(recordTypes[0].DeveloperName);
        // Perform assertions to validate the results
        System.assertEquals(1, queriedRecordTypes.size(), 'Expected one record type');
        System.assertEquals(leadRecordTypeId, queriedRecordTypes[0].Id, 'Unexpected record type ID');
    }

    @IsTest
    static void testQueryLeadsPhoneNumbers(){
        Id leadId = [SELECT Id FROM Lead LIMIT 1].Id;
        Test.startTest();
        List<Lead> leads = LeadData.queryLeadsPhoneNumbers(leadId);
        Test.stopTest();
        System.assertEquals('6678769876', leads[0].Phone);
        System.assertEquals('9876543221', leads[0].Work_Phone__c);
        System.assertEquals(null, leads[0].MobilePhone);
    }

    /**Test Method for LeadData.queryLead */
    @isTest
    static void testQueryLeadWithFields() {
        List<Lead> leads = [SELECT Id FROM Lead];
        Set<String> fields = new Set<String> {'Id', 'FirstName', 'LastName'};
        Test.startTest();
        List<Lead> queriedLeads = LeadData.queryLead(leads[0].Id, fields);
        Test.stopTest();
        System.assertEquals('John', queriedLeads[0].FirstName, 'Verify the Lead Instance has FirstName');
        System.assertEquals('Doe', queriedLeads[0].LastName, 'Verify the Lead Instance has LastName');
    }
    
     @isTest
    static void testgetLeadList() {
        List<Lead> leads = [SELECT Id FROM Lead];
        List<Object> fields = new List<Object> {'Id', 'FirstName', 'LastName'};
        Test.startTest();
        List<Lead> queriedLeads = LeadData.getLeadList(fields,New Set<Id>{ leads[0].Id});
        Test.stopTest();
        System.assertNotEquals(Null,queriedLeads);
    }
    
    @isTest
    static void testqureyLeadsWithSamePhone() {
        List<Lead> leads = [SELECT Id FROM Lead];
        List<Object> fields = new List<Object> {'Id', 'FirstName', 'LastName'};
        Test.startTest();
        List<Lead> queriedLeads = LeadData.qureyLeadsWithSamePhone(New Set<String> {'6678769876'},leads);
        Test.stopTest();
        System.assertNotEquals(Null,queriedLeads);
    }
    
    @isTest
    static void testqueryLeadsWithoutIndividualReference() {
        List<Lead> leads = [SELECT Id FROM Lead];
        List<Object> fields = new List<Object> {'Id', 'FirstName', 'LastName'};
        Test.startTest();
        List<Lead> queriedLeads = LeadData.queryLeadsWithoutIndividualReference(New Set<String> {'6678769876'});
        Test.stopTest();
        System.assertNotEquals(Null,queriedLeads);
    }
    
     @isTest
    static void testqueryActiveleadOfIndividuals() {
        List<Lead> leads = [SELECT Id FROM Lead];
        List<Object> fields = new List<Object> {'Id', 'FirstName', 'LastName'};
        Test.startTest();
        Map<Id,Lead> queriedLeads = LeadData.queryActiveleadOfIndividuals(New Set<Id> {leads[0].Id});
        Test.stopTest();
        System.assertNotEquals(Null,queriedLeads);
    }
    
    @isTest
    static void getReshuffleLeadsQueryMdtForBatchClassTest(){
        List<String> subDispositionQueryStringList = leadData.getReshuffleLeadsQueryMdtForBatchClass();
        System.assertNotEquals(Null,subDispositionQueryStringList);
    }
}
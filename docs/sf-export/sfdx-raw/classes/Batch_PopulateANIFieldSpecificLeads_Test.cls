@isTest
public with sharing class Batch_PopulateANIFieldSpecificLeads_Test {
    @testSetup
    static void makeData() { 
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Lead leadRecord = DataFactoryTest.createBusinessLead();
        leadRecord.Phone = '8888888888';
        leadRecord.Email = 'testemail1@gmail.com';
        insert leadRecord;
    }

    @isTest
    static void testPopulateANIFieldSpecificLeads() {
        Test.startTest();
        String query = 'SELECT Id FROM Lead';
        Database.executeBatch(new Batch_PopulateANIFieldsSpecificLeads(query), 20);
        Test.stopTest();       
    }
}
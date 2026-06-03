@isTest
public with sharing class LeadPaymentCalcControllerTest {

    @testSetup
    static void makeData() {
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Lead leadRecord = DataFactoryTest.createListLead();
        insert leadRecord;
    }

    @isTest
    static void verifyGetRecordTypeDeveloperName() {
        List<Lead> leadRecord = [SELECT Id FROM Lead];
        Test.startTest();
        ApexActionResult result = LeadPaymentCalcController.getRecordTypeDeveloperName(leadRecord[0].Id);
        Test.stopTest();
        Lead leadRec = (Lead)result.data;
        System.assertEquals(LeadUtil.getRecordTypeId(LeadUtil.RT_LIST_LEAD), leadRec.RecordTypeId);
    }

    @isTest
    static void verifyGetRecordTypeBasedOnRTName() {
        Test.startTest();
        ApexActionResult result = LeadPaymentCalcController.getRecordTypeBasedOnRTName(LeadUtil.RT_LIST_LEAD);
        Test.stopTest();
        RecordType recordType = (RecordType)result.data;
        System.assertEquals(LeadUtil.RT_LIST_LEAD, recordType.DeveloperName);
    }

    @isTest
    static void verifyIsAdminProfile() {
        List<Profile> profileRec = [SELECT Id FROM Profile WHERE Name = 'System Administrator'];
        User userRec = DataFactoryTest.createUser(profileRec[0].Id);
        ApexActionResult result;
        System.runAs(userRec) {
            Test.startTest();
                result = LeadPaymentCalcController.checkIsAgentProfile();
            Test.stopTest();
        }
        System.assertEquals('isAdmin', result.data);
    }

    @isTest
    static void verifySaveLeadDetails() {
        List<Lead> leadRecord = [SELECT Id, LastName FROM Lead];
        ApexActionResult result;
        Test.startTest();
        result = LeadPaymentCalcController.saveLeadDetails(JSON.serialize(leadRecord[0]));
        Test.stopTest();
        List<Lead> leadQueried = [SELECT Id, LastName FROM Lead];
        System.assertEquals('Test Lead', leadQueried[0].LastName);
    }

    @isTest
    static void verifyCurrentRecordDetails() {
        List<Lead> leadRecord = [SELECT Id, LastName FROM Lead];
        ApexActionResult result;
        Test.startTest();
        result = LeadPaymentCalcController.getCurrentRecordDetails(leadRecord[0].Id);
        Test.stopTest();
        System.assert(String.isNotBlank((String)result.data));
    }

    @isTest
    static void verifyGetPaymentCalcSettings() {
        Payment_Calculator_Settings__c paymentSettings = DataFactoryTest.createPaymentCalculatorSettings();
        insert paymentSettings;
        ApexActionResult result;
        Test.startTest();
        result = LeadPaymentCalcController.getPaymentCalcSettings();
        Test.stopTest();
        System.assert(String.isNotBlank((String)result.data));
    }
}
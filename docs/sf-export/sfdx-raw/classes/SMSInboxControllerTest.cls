@isTest
public with sharing class SMSInboxControllerTest {
    @TestSetup
    static void makeData() {
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Lead leadRecord = DataFactoryTest.createBusinessLead();
        insert leadRecord;

        Account accountRecord = DataFactoryTest.createAccount();
        insert accountRecord;

        Contact contactRecord = DataFactoryTest.createContact();
        insert contactRecord;

        SMS__c smsOutboundRecord = DataFactoryTest.createOutboundSMS();
        insert smsOutboundRecord;

        SMS__c smsInboundRecord = DataFactoryTest.createInboundSMS();
        insert smsInboundRecord;

        List<Profile> profileRec = [SELECT Id FROM Profile WHERE Name = 'System Administrator'];
        User userData = DataFactoryTest.createUser(profileRec[0].Id);
        insert userData;
    }

    @isTest
    static void verifyFetchCurrentRecordDetailsLead() {
        List<Lead> leads = [SELECT Id FROM Lead];
        Test.startTest();
        ApexActionResult result = SMSInboxController.fetchCurrentRecordDetails(leads[0].Id);
        Test.stopTest();
        Set<String> resultPhoneNumbers = (Set<String>)result.data;
        String phoneNumber = 'Phone: ' + DataFactoryTest.createBusinessLead().Phone;
        System.assert(resultPhoneNumbers.contains(phoneNumber), 'Verify the Lead Phone Number');
    }

    @isTest
    static void verifyFetchCurrentRecordDetailsAccount() {
        List<Account> accounts = [SELECT Id FROM Account];
        Test.startTest();
        ApexActionResult result = SMSInboxController.fetchCurrentRecordDetails(accounts[0].Id);
        Test.stopTest();
        Set<String> resultPhoneNumbers = (Set<String>)result.data;
        String phoneNumber = 'Phone: ' + DataFactoryTest.createBusinessLead().Phone;
        System.assert(resultPhoneNumbers.contains(phoneNumber), 'Verify the Account Phone Number');
    }

    @isTest
    static void verifyFetchCurrentRecordDetailsContact() {
        List<Contact> contacts = [SELECT Id FROM Contact];
        Test.startTest();
        ApexActionResult result = SMSInboxController.fetchCurrentRecordDetails(contacts[0].Id);
        Test.stopTest();
        Set<String> resultPhoneNumbers = (Set<String>)result.data;
        String phoneNumber = 'Phone: ' + DataFactoryTest.createBusinessLead().Phone;
        System.assert(resultPhoneNumbers.contains(phoneNumber), 'Verify the Contact Phone Number');
    }

    @isTest
    static void verifyQuerySMSRecords() {
        Test.startTest();
        ApexActionResult result = SMSInboxController.querySMSRecords('8734560945');
        Test.stopTest();
        String resultData = (String)result.data;
        List<SMSWrapper> smsWrapList = (List<SMSWrapper>)JSON.deserialize(resultData, List<SMSWrapper>.class);
        System.assertEquals(2, smsWrapList.size());
        System.assertEquals('Test SMS', smsWrapList[0].smsBody);
    }

    @isTest
    static void verifySendSMS() {
        SMS__c smsOutboundRecord = DataFactoryTest.createOutboundSMS();
        insert smsOutboundRecord;
        SMSWrapper smsWrap = new SMSWrapper(smsOutboundRecord);
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        SMSInboxController.sendSMS(JSON.serialize(smsWrap));
        Test.stopTest();
        List<SMS__c> smsQueried = [SELECT Id, Outbound_Failure_Reason__c FROM SMS__c];
        System.assertEquals(null, smsQueried[0].Outbound_Failure_Reason__c, 'Verify the outbound failure reason is blank');
    }

    /**Test Method for  SMSInboxController.querySMSTemplates*/
    @isTest
    static void verifyQuerySMSTemplates() {
        List<Lead> leads = [SELECT Id FROM Lead];
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        ApexActionResult result = SMSInboxController.querySMSTemplates(leads[0].Id);
        List<SMSTemplate> smsTemplateList = (List<SMSTemplate>)JSON.deserialize(String.valueOf(result.data), List<SMSTemplate>.class);
        Test.stopTest();
        System.assertEquals('Test Body', smsTemplateList[0].smsBody, 'Verify the sms body from SMS Template');
    }

    /**Test Method for SMSInboxController.querySMSTemplates*/
    @isTest
    static void verifyMergeFieldsInSMSLead() {
        List<Lead> leads = [SELECT Id FROM Lead];
        List<User> users = [SELECT Id FROM User WHERE Email = 'puser000@amamama.com'];
        String smsBody = 'Hi [LastName], this is [User.Name] from Company ABC';
        ApexActionResult result;
        System.runAs(users[0]) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
            result = SMSInboxController.mergeFieldsInSMS(leads[0].Id, smsBody);
            Test.stopTest();
        }
        System.assertEquals('Hi Test Lead, this is last from Company ABC', (String)result.data, 'Verify the custom merge field');
    }

    /**Test Method for SMSInboxController.querySMSTemplates*/
    @isTest
    static void verifyMergeFieldsInSMSAccount() {
        List<Account> accounts = [SELECT Id FROM Account];
        List<User> users = [SELECT Id FROM User WHERE Email = 'puser000@amamama.com'];
        String smsBody = 'Hi [LastName], this is [User.Name] from Company ABC';
        ApexActionResult result;
        System.runAs(users[0]) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
            result = SMSInboxController.mergeFieldsInSMS(accounts[0].Id, smsBody);
            Test.stopTest();
        }
        System.assertEquals('Hi Account, this is last from Company ABC', (String)result.data, 'Verify the custom merge field');
    }
}
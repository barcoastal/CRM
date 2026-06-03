@isTest
public with sharing class SMSTemplateDataTest {
    
    /**Test Method for SMSTemplateData.queryRecords */
    @isTest
    static void testSMSTemplateDataTest() {
        Test.startTest();
        List<SMS_Template__mdt> smsTemplates = SMSTemplateData.queryRecords(new LeadUtil().getSObjName());
        Test.stopTest(); 
        System.assertEquals('Test Body', smsTemplates[0].SMS_Body__c);
    }
}
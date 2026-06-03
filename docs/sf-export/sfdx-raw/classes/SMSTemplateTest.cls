@isTest
private with sharing class SMSTemplateTest {
    
    /**Test Method for SMSTemplate wrapper class */
    @isTest
    static void testSMSTemplate() {
        SMS_Template__mdt smsTemplateRecord = DataFactoryTest.createSMSTemplate();
        Test.startTest();
        SMSTemplate smsTemp = new SMSTemplate(smsTemplateRecord);
        Test.stopTest(); 
        System.assertEquals('Test Body', smsTemp.smsBody);
    }
}
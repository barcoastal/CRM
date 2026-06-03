/**
* @Description: Testmethod to validate SMSObjectUtility class. 
*/
@isTest
private with sharing class SMSObjectUtilityTest {
    
    @IsTest
    static void testCreateInboundSMS(){
        
        TwilioSMSWrapper smsWrapper = new TwilioSMSWrapper(); 
        smsWrapper.fromPhone = '+14564785678'; 
        smsWrapper.toPhone = '+16785674567';
        smsWrapper.messageBody = 'testCreateInboundSMS';
        
        Test.startTest();
        SMSObjectUtility.createInboundSMS(smsWrapper);
        Test.stopTest();
        
        List<SMS__c> smsList = SMSTestUtility.getSMSByToPhone(smsWrapper.toPhone);
        System.assertEquals(1, smsList.size(),'To validate only one inbound record is created');
    }
    
    @IsTest
    static void testCreateInboundSMS_Bulk(){
        
        TwilioSMSWrapper smsWrapper = new TwilioSMSWrapper(); 
        smsWrapper.fromPhone = '+14564785678'; 
        smsWrapper.toPhone = '+16785674567';
        smsWrapper.messageBody = 'testCreateInboundSMS';
        
        Test.startTest();
        List<SMS__c> smsList = SMSObjectUtility.createInboundSMS(new List<TwilioSMSWrapper>{smsWrapper});
        Test.stopTest();
        
        System.assertEquals(1, smsList.size(),'To validate only one inbound record is created');
        System.assertEquals('+14564785678', smsList[0].From_Phone__c);
        System.assertEquals('+16785674567', smsList[0].To_Phone__c);
        System.assertEquals('testCreateInboundSMS', smsList[0].Message_Body__c);
        System.assertEquals(true, smsList[0].Is_Inbound__c);
    }
    
    @IsTest
    static void testCreateOutboundSMS(){
        TwilioSMSWrapper smsWrapper = new TwilioSMSWrapper(); 
        smsWrapper.fromPhone = '+14564785678'; 
        smsWrapper.toPhone = '+16785674567';
        smsWrapper.messageBody = 'testCreateInboundSMS';
        
        Test.startTest();
        SMSObjectUtility.createOutboundSMS(smsWrapper);
        Test.stopTest();
        
        List<SMS__c> smsList = SMSTestUtility.getSMSByToPhone(smsWrapper.toPhone);       
        System.assertEquals(1, smsList.size(),'To validate only one SMS record is created');
        System.assertEquals(smsList[0].Is_Inbound__c,false, 'To Validate In bound is set to false for outbound messages');
    }
}
@IsTest
private class SMSWrapperTest {

    @IsTest
    static void smsWrapper_Outbound(){
        
        Test.startTest();
        SMS__c smsInstance = DataFactoryTest.createOutboundSMS();
        insert smsInstance;
        SMSWrapper smsWrap = new SMSWrapper(SMSData.querySMS('8734560945')[0]);
        SMS__c verifySMS = smsWrap.getSMSInstance();
        Test.stopTest();

        System.assertEquals(smsWrap.recordId, verifySMS.Id);
        System.assertEquals(smsWrap.smsBody, verifySMS.Message_Body__c);
        System.assertEquals(smsWrap.fromPhone, verifySMS.From_Phone__c);
        System.assertEquals(smsWrap.toPhone, verifySMS.To_Phone__c);
        System.assertEquals(smsWrap.isInbound, verifySMS.Is_Inbound__c);
    }
    
    @IsTest
    static void smsWrapper_Inbound(){
        
        Test.startTest();
        SMS__c smsInstance = DataFactoryTest.createInboundSMS();
        insert smsInstance;
        SMSWrapper smsWrap = new SMSWrapper(SMSData.querySMS('8734560945')[0]);
        SMS__c verifySMS = smsWrap.getSMSInstance();
        Test.stopTest();

        System.assertEquals(smsWrap.recordId, verifySMS.Id);
        System.assertEquals(smsWrap.smsBody, verifySMS.Message_Body__c);
        System.assertEquals(smsWrap.fromPhone, verifySMS.From_Phone__c);
        System.assertEquals(smsWrap.toPhone, verifySMS.To_Phone__c);
        System.assertEquals(smsWrap.isInbound, verifySMS.Is_Inbound__c);
    }
}
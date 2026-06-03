@IsTest
private class SMSDataTest {
    
    @IsTest
    static void queryInboundSMSTest(){
        
        Test.startTest();
        SMS__c smsRecord = DataFactoryTest.createInboundSMS();
        insert smsRecord;
        List<SMS__c> smsInstance = SMSData.querySMS('8734560945');
        List<SMS__c> smsInstance1 = SMSData.querySMS('+18734560945');
        Test.stopTest();
        
        System.assertEquals(true, smsInstance[0].Is_Inbound__c);
        System.assertEquals('Test SMS', smsInstance[0].Message_Body__c);
        System.assertEquals('8734560945', smsInstance[0].From_Phone__c);
        System.assertEquals('6498345678', smsInstance[0].To_Phone__c);
        System.assertEquals(UserInfo.getName(), smsInstance1[0].CreatedBy.Name);
        System.assertEquals(System.today(), smsInstance1[0].CreatedDate.date());
        System.assertEquals(System.today(), smsInstance1[0].Sent_Received_Time__c.date());
        System.assertEquals(null, smsInstance1[0].Outbound_Failure_Reason__c);
    }

    @IsTest
    static void queryOutboundSMSTest(){
        
        Test.startTest();
        SMS__c smsRecord = DataFactoryTest.createOutboundSMS();
        insert smsRecord;
        List<SMS__c> smsInstance = SMSData.querySMS('8734560945');
        List<SMS__c> smsInstance1 = SMSData.querySMS('+18734560945');
        Test.stopTest();
        
        System.assertEquals(false, smsInstance[0].Is_Inbound__c);
        System.assertEquals('Test SMS', smsInstance[0].Message_Body__c);
        System.assertEquals('8734560945', smsInstance[0].To_Phone__c);
        System.assertEquals('6498345678', smsInstance[0].From_Phone__c);
        System.assertEquals(UserInfo.getName(), smsInstance1[0].CreatedBy.Name);
        System.assertEquals(System.today(), smsInstance1[0].CreatedDate.date());
        System.assertEquals(null, smsInstance1[0].Sent_Received_Time__c);
        System.assertEquals(null, smsInstance1[0].Outbound_Failure_Reason__c);
    }
}
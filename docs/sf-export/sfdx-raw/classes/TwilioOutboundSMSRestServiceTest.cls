@IsTest
private class TwilioOutboundSMSRestServiceTest {
    
    @IsTest
    static void doPostTest_Success() {
        
        // Create an instance of the TwilioSMSWrapper class
        TwilioSMSWrapper wrapper = new TwilioSMSWrapper();        
        // Set the property values
        wrapper.accountSID = 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
        wrapper.fromPhone = '+1234567890';
        wrapper.fromCity = 'City';
        wrapper.fromState = 'State';
        wrapper.fromZip = '12345';
        wrapper.fromCountry = 'Country';
        wrapper.messageSid = 'MSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
        wrapper.toPhone = '+9876543210';
        wrapper.messageBody = 'Test message';

        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/twilio/outbound/sms/*'; 
        req.requestBody = Blob.valueof(JSON.serialize(wrapper));
        req.httpMethod = 'POST';
        req.addHeader('Content-Type', 'application/json'); 
        RestContext.request = req;
        RestContext.response = res;

        Test.startTest();
        String result = TwilioOutboundSMSRestService.doPost();
        Test.stopTest();
        
        SMS__c verifySMS = [SELECT Id, From_Phone__c, Is_Inbound__c, Message_Body__c, To_Phone__c FROM SMS__c LIMIT 1];
        System.assertEquals('+1234567890', verifySMS.From_Phone__c);
        System.assertEquals('+9876543210', verifySMS.To_Phone__c);
        System.assertEquals('Test message', verifySMS.Message_Body__c);
        System.assertEquals(false, verifySMS.Is_Inbound__c);
    }
    
    @IsTest
    static void doPostTest_Failure() {
        
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/twilio/outbound/sms/*'; 
        req.httpMethod = 'POST';
        req.addHeader('Content-Type', 'application/json'); 
        RestContext.request = req;
        RestContext.response = res;

        Test.startTest();
        String result = TwilioOutboundSMSRestService.doPost();
        Test.stopTest();
        
        Application_Log__c verifyEvent = [
            SELECT Id, Exception_Message__c, Exception_StackTrace__c, Log_Type__c 
            FROM Application_Log__c LIMIT 1
        ];
        System.assertEquals('Argument cannot be null.', verifyEvent.Exception_Message__c);
        System.assert(verifyEvent.Exception_StackTrace__c.contains('Class.TwilioOutboundSMSRestService.doPost'));
        System.assertEquals('Error', verifyEvent.Log_Type__c);
    }
}
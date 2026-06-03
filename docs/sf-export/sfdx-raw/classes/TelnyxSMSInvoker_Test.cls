@IsTest
public with sharing class TelnyxSMSInvoker_Test {
    
    @isTest
    static void testSendSMS() {
        TelnyxSMSInvoker.InputRequest req = new TelnyxSMSInvoker.InputRequest();
        req.phoneNumber = '+1983487345687';
        req.verifyProfileId = '24553-4a14-e201-89a1-4535435344';
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new TelnyxSMSInvoker_Test.TelnyxSMSMock());
        TelnyxSMSInvoker.sendSMS(new List<TelnyxSMSInvoker.InputRequest>{req});
        Test.stopTest();
    }

    @isTest
    static void testVerifyCode() {
        TelnyxVerifyCode.InputRequest req = new TelnyxVerifyCode.InputRequest();
        req.phoneNumber = '+1983487345687';
        req.verifyProfileId = '24553-4a14-e201-89a1-4535435344';
        req.code = '123456';
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new TelnyxSMSInvoker_Test.TelnyxSMSMock());
        TelnyxVerifyCode.verifyCode(new List<TelnyxVerifyCode.InputRequest>{req});
        Test.stopTest();
    }
    
    public class TelnyxSMSMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            response.setStatus('OK');
            response.setHeader('Content-Type', 'application/json');
            
            String url = request.getEndpoint();
            if (url != null && url.toLowerCase().contains('/actions/verify')) {
            	response.setBody('{"data":{"phone_number":"+1983487345687","verify_profile_id":"24553-4a14-e201-89a1-4535435344","timeout_secs":300,"custom_code":null,"extension":null,"id":"vfy_01HFQ0AM9Z8MZP8A4GJ3B2R9QG","type":"sms","status":"accepted","created_at":"2025-11-04T14:18:22Z","updated_at":"2025-11-04T14:18:22Z","record_type":"verification","failed_attempts":0,"mccmnc":"310260","delivery_status":"queued"}}');
            } else {
                response.setBody('{"data":{"phone_number":"+1983487345687","verify_profile_id":"24553-4a14-e201-89a1-4535435344","response_code":"verified","message":"Code verified successfully."}}');
            } 
            return response;
        }
    }
}
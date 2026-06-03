@isTest
private with sharing class WebLeadsRestServiceTest {
    
    @IsTest
    static void doPostTestWebLead_Success(){
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(true, null, 'insert'));
        Map<String, String> reqParams = new Map<String, String> {'first_name'=>'Testing 1','last_name'=>'', 
            'email'=>'abcd@gmail.com','phone_number'=>'1231231233','state'=>'ak','lead_source'=>'ABC','vendor_id'=>'GHJ',
            'ad_id'=>'HJK','estimated_total_debt'=>'ASDF','campaign_name'=>'test campaign name','has_multiple_mca'=>'tRuE'};
        
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/WebLeads';
        req.resourcePath = '/services/apexrest/WebLeads/*';
        req.httpMethod = 'POST';
        req.params.putAll(reqParams);
        RestContext.request = req;
        RestContext.response= res;

        Test.startTest();
        WebLeadsRestService.doPost();
        Test.stopTest();
        Lead verifyLead = [SELECT Id, FirstName FROM Lead WHERE Email = 'abcd@gmail.com'  LIMIT 1];
        System.assertEquals('Testing 1', verifyLead.FirstName, 'Expected valid success response.');
    }

    @IsTest
    static void doPostTestWebLead_Success2(){
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(true, null, 'insert'));
        Map<String, String> reqParams = new Map<String, String> {'first_name'=>'Testing 1','last_name'=>'', 
            'email'=>'abcd@gmail.com','phone_number'=>'1231231233','state'=>'alasKa','lead_source'=>'ABC','vendor_id'=>'GHJ',
            'ad_id'=>'HJK','estimated_total_debt'=>'ASDF','campaign_name'=>'test campaign name','has_multiple_mca'=>'tRuE'};
        
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/WebLeads';
        req.resourcePath = '/services/apexrest/WebLeads/*';
        req.httpMethod = 'POST';
        req.params.putAll(reqParams);
        RestContext.request = req;
        RestContext.response= res;

        Test.startTest();
        WebLeadsRestService.doPost();
        Test.stopTest();
        Lead verifyLead = [SELECT Id, State FROM Lead WHERE Email = 'abcd@gmail.com'  LIMIT 1];
        Assert.areEqual('Alaska', verifyLead.State, 'Expected valid success response.');
    }

    @IsTest
    static void doPostTestWebLead_PartialSuccess(){
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(true, null, 'insert'));
        Map<String, String> reqParams = new Map<String, String> {'first_name'=>'Testing 1','last_name'=>'', 
            'email'=>'abcd@gmailcom','phone_number'=>'1231231233','state'=>'abcd','lead_source'=>'ABC','vendor_id'=>'GHJ',
            'ad_id'=>'HJK','estimated_total_debt'=>'ASDF','campaign_name'=>'test campaign name','has_multiple_mca'=>'tRuE'};
        
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/WebLeads';
        req.resourcePath = '/services/apexrest/WebLeads/*';
        req.httpMethod = 'POST';
        req.params.putAll(reqParams);
        RestContext.request = req;
        RestContext.response= res;

        Test.startTest();
        WebLeadsRestService.doPost();
        Test.stopTest();
        Application_Log__c log = [SELECT Id, Exception_Message__c, Severity__c FROM Application_Log__c LIMIT 1];
        Assert.areEqual('Low', log.Severity__c, 'Expected Severity is Low');
    }

    @IsTest
    static void doPostTestWebLead_Failure(){
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator(true, null, 'insert'));
        Map<String, String> reqParams = new Map<String, String> {'first_name'=>'TestTestTestTestTestTestTestTestTestTest1','last_name'=>'', 
            'email'=>'abcd@gmailcom','phone_number'=>'1231231233','state'=>'abcd','lead_source'=>'ABC','vendor_id'=>'GHJ',
            'ad_id'=>'HJK','estimated_total_debt'=>'ASDF','campaign_name'=>'test campaign name','has_multiple_mca'=>'tRuE'};
        
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/WebLeads';
        req.resourcePath = '/services/apexrest/WebLeads/*';
        req.httpMethod = 'POST';
        req.params.putAll(reqParams);
        RestContext.request = req;
        RestContext.response= res;

        Test.startTest();
        WebLeadsRestService.doPost();
        Test.stopTest();
        Application_Log__c log = [SELECT Id, Exception_Message__c, Severity__c FROM Application_Log__c LIMIT 1];
        Assert.areEqual('High', log.Severity__c, 'Expected Severity is High');

        /* Code to cover no params request response. */
        RestRequest req2 = new RestRequest(); 
        RestResponse res2 = new RestResponse();
        req2.requestURI = '/WebLeads';
        req2.resourcePath = '/services/apexrest/WebLeads/*';
        req2.httpMethod = 'POST';
        RestContext.request = req2;
        RestContext.response= res2;
        WebLeadsRestService.doPost();
    }

    public class MockHttpResponseGenerator implements HttpCalloutMock {

        private Boolean success;
        private Integer errorCode;
        private String calloutType;

        public MockHttpResponseGenerator(Boolean success, Integer errorCode, String calloutType) {
            this.success = success;
            this.errorCode = errorCode;
            this.calloutType = calloutType;
        }

        public HttpResponse respond(HttpRequest request) {

            HttpResponse response = new HttpResponse();
            response.setHeader('Content-Type', 'application/json');
            response.setStatusCode(200);
            response.setStatus('OK');
            if (success) {
                if (calloutType == 'insert') {
                    response.setBody('{"success": true, "data": {"lead_id": 1947826}, "id": 1947826}');
                } else if (calloutType == 'update') {
                    response.setBody('{"success": true, "data": {"lead_id": 1947827}}');
                } else if (calloutType == 'delete') {
                    response.setBody('{"success": true}');
                }
            } else {
                if (errorCode == 6007) {
                    response.setBody('{"success": false, "code": 6007, "text": "The Lead requires a phone number and list id"}');
                } else if (errorCode == 6008) {
                    response.setBody('{"success": false, "code": 6008, "text": "The phone number is invalid"}');
                } else if (errorCode == 6001) {
                    response.setBody('{"success": false, "code": 6001, "text": "No such Lead"}');
                } else {
                    response.setBody('{"success": false}');
                }
            }
            return response;
        }
    }
}
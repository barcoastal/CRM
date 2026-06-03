@isTest
private class LeadsRestServiceTest {

    @IsTest
    static void doPostTestWithDisposition_Success(){
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());

        Account vendor = new Account(Name = 'Vendor Company');
        insert vendor;

        Lead newLead = new Lead(LastName = 'Test Lead', Phone='4166661216');
        insert newLead;

        Map<String, String> reqParams = new Map<String, String> {'Status'=>'CAXFER', 'Fronter__c'=>'Test Agent'};
        
        Test.startTest();
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/Leads';
        req.resourcePath = '/services/apexrest/Leads/*';
        req.httpMethod = 'POST';
        req.params.putAll(reqParams);
        RestContext.request = req;
        RestContext.response= res;
        LeadsRestService.doPost();
        Test.stopTest();
    }
}
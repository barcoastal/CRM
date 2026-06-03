@isTest
public class RoutingNumberServiceTest {
    
    private class RoutingNumberServiceMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            res.setBody('{"isSuccess": true}');
            return res;
        }
    }

    @TestSetup
    static void makeData() {
        SAS_Settings__c settings = new SAS_Settings__c();
        settings.Endpoint__c = 'https://test.com';
        insert settings;

        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Name = 'Test Account';
        acctRecord.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        insert acctRecord;
    }
    
    @IsTest
    static void testValidRoutingNumber() {
        Test.setMock(HttpCalloutMock.class, new RoutingNumberServiceMock());
        String routingNumber = '123456789';
        List<Account> accList = [SELECT Id FROM Account LIMIT 1];
        String accountId = accList[0].Id;

        Test.startTest();
        	RoutingNumberService.RoutingNumberResponse response =
            RoutingNumberService.validateRoutingNumber(routingNumber, accountId);
        Test.stopTest();

        System.assertEquals(false, response.isValid);
        System.assertEquals('Routing number is invalid.', response.message);
    }

}
@isTest
private class ApplicationEventHandlerTest {
    
    @IsTest
    static void testAccountException() {
        
        Account acc = new Account(Name = 'Test Account');
        insert acc;
        
        Test.startTest();
        try{
            acc.UCC_Filing_Date__c = Date.valueOf('11:30:54.000+0000');
            update acc;
        } catch(Exception exp) {
            ApplicationLogger.logException(exp, acc.Id);
        }
        Test.stopTest();
        
        Application_Log__c verifyEvent = [
            SELECT Id, Exception_Message__c, Exception_StackTrace__c, Record_Id__c, Log_Type__c 
            FROM Application_Log__c LIMIT 1
        ];
        System.assertEquals('Invalid date: 11:30:54.000+0000', verifyEvent.Exception_Message__c);
        System.assertEquals(acc.Id, verifyEvent.Record_Id__c);
        System.assertEquals('Error', verifyEvent.Log_Type__c);
    }
    
    @IsTest
    static void testCalloutDataException() {
        
        Callout_Data__c cd = new Callout_Data__c();
        insert cd;
        
        Test.startTest();
        try{
            cd.DateStart__c = DateTime.valueOf('2023-06-24T11:30:54.000+0000');
            update cd;
        } catch(Exception exp) {
            ApplicationLogger.logException(exp, cd.Id);
        }
        Test.stopTest();
        
        Application_Log__c verifyEvent = [
            SELECT Id, Exception_Message__c, Exception_StackTrace__c, Record_Id__c, Log_Type__c, Statement__c 
            FROM Application_Log__c LIMIT 1
        ];
        System.assertEquals('Invalid date/time: 2023-06-24T11:30:54.000+0000', verifyEvent.Exception_Message__c);
        System.assertEquals(cd.Id, verifyEvent.Record_Id__c);
        System.assertEquals('Error', verifyEvent.Log_Type__c);
    }
    
    @IsTest
    static void testCalloutDataItemException() {
        
        Callout_Data__c cd = new Callout_Data__c();
        insert cd;
        
        Callout_Data_Item__c cdi = new Callout_Data_Item__c(Callout_Data__c = cd.Id);
        insert cdi;
        
        Test.startTest();
        try{
            cdi.Email__c = 'test@client.com:51:06.273';
            update cdi;
        } catch(Exception exp) {
            ApplicationLogger.logDMLException('INVALID_EMAIL_ADDRESS', cdi.Id, exp.getMessage());
        }
        Test.stopTest();
        
        Application_Log__c verifyEvent = [
            SELECT Id, Exception_Message__c, Exception_StackTrace__c, Record_Id__c, Log_Type__c, Statement__c
            FROM Application_Log__c LIMIT 1
        ];
        System.assertEquals('Update failed. First exception on row 0 with id '+cdi.Id+'; first error: INVALID_EMAIL_ADDRESS, Email: invalid email address: test@client.com:51:06.273: [Email__c]', verifyEvent.Exception_Message__c);
        System.assertEquals('INVALID_EMAIL_ADDRESS', verifyEvent.Statement__c);
        System.assertEquals(cdi.Id, verifyEvent.Record_Id__c);
        System.assertEquals('Error', verifyEvent.Log_Type__c);
    }
    
    public class MockHttpResponseGenerator implements HttpCalloutMock {

        public HttpResponse respond(HttpRequest request) {

            HttpResponse response = new HttpResponse();
            response.setHeader('Content-Type', 'application/json');
            response.setStatusCode(200);
            response.setStatus('OK');
            response.setBody('{"success": true, "data": {"lead_id": 1947826}, "id": 1947826}');
            return response;
        }
    }
}
@isTest
private class ScheduleSASGetBalancesTest {
    
    @IsTest
    static void scheduleGetBalancesTest(){
        
        insert new SAS_Settings__c(Endpoint__c = 'https://test.com');
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        Datetime dt = Datetime.now();
        System.debug('0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?');
        String jobId = System.schedule(
            'Schedule Get Balances batch test', 
            '0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?', 
            new ScheduleSASGetBalances()
        ); 
        Test.stopTest();
        
        CronTrigger job = [SELECT Id, CronJobDetail.Id, CronJobDetail.JobType, TimesTriggered FROM CronTrigger WHERE id = :jobId];
        System.assertEquals(0, job.TimesTriggered);
        System.assertEquals(1, [SELECT COUNT() FROM CronJobDetail WHERE Id = :job.CronJobDetail.Id AND JobType = '7']);
    }
    
    public class MockHttpResponseGenerator implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setHeader('Content-Type', 'application/json');
            response.setStatusCode(200);
            response.setStatus('OK');
			response.setBody(
                '{"RequestID": 855, "PrimaryKeyID": 0, "Success": true, "Message": "The customer record cannot be found.", "Records": 0, "ProcessData": null, '
                +'"EchoRequest": "Form Variables:\\r\\nQueryString Variables:\\r\\nAPIKey = test\\r\\nCompanyKey = 2\\r\\nMethod = GetBalances\\r\\n"}'
            );
            return response;
        }
    }
}
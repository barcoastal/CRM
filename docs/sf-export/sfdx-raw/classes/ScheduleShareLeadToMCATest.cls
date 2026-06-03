@IsTest
private class ScheduleShareLeadToMCATest {

    @IsTest
    static void shareLeadTOMCATest(){
        
        Lead leadRec = DataFactoryTest.createListLead();
        leadRec.Email = 'test@gmail.com';
        leadRec.Street = 'Test Street';
        leadRec.City = 'Test City';
        leadRec.State = 'Florida';
        leadRec.PostalCode ='9987654';
        leadRec.Status = 'Transfer';
        insert leadRec;  
        
        insert new MCA_Lender_Settings__c(Endpoint__c = 'https://test.com', Last_Run_Time__c=System.now()); 
           
        leadRec.five9_Disposition__c = 'LOOKING FOR A LOAN';
        update leadRec;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());       
        
        Datetime dt = Datetime.now();
        System.debug('0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?');
        String jobId = System.schedule(
            'Schedule share lead to MCA batch', 
            '0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?', 
            new ScheduleShareLeadToMCA()
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
            response.setBody('Success: 1947826');
            return response;
        }
    }
}
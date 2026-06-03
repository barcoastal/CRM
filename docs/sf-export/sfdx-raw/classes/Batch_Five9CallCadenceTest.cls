@IsTest
private class Batch_Five9CallCadenceTest {

    @IsTest
    static void setRedialTime(){    
        Id ProfileId = [SELECT Id,Name FROM Profile WHERE Name = 'Closer' ][0].Id;
        user closerUser = DataFactoryTest.createUser(ProfileId);
        insert closerUser;
        
        Id dispositionRTId = TaskUtil.getRecordTypeId('Disposition');
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        insert oppInstance;
        
        Contact conInstance = DataFactoryTest.createContact();       
        insert conInstance;
        
        Sync_Redial_Time__c syncRedialTime = DataFactoryTest.createSyncRedialTime();
        insert syncRedialTime;
        
        Lead leadInstance = new Lead(
            FirstName='Test', LastName='Lead Julia', Email='julia.sample@company.com', Phone='4166661216', Status='Open - Not Contacted', Call_counter__c=4
        ); 
        
        Lead leadInstance2 = new Lead(
            FirstName='Test', LastName='Lead Julia', Email='julia.sample@company.com', Phone='4166661215', Status='NO ANSWER', Call_counter__c=4
        );    
                
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        insert leadInstance;
        insert leadInstance2;
        List<Task> taskList = new List<Task>{ new Task(
            whoId = leadInstance.Id,
            Subject = 'Other',
            Disposition__c = 'CALL TRANSFERRED',
            RecordTypeId = dispositionRTId 
        ),new Task(
            WhatId = oppInstance.Id,
            Subject = 'Meeting',
            Disposition__c = 'CALL TRANSFERRED',
            RecordTypeId = dispositionRTId 
        ),new Task(
            WhoId= conInstance.Id,
            Subject = 'Call Transferred',
            Disposition__c = 'CALL TRANSFERRED',
            RecordTypeId = dispositionRTId 
        ),new Task(
            whoId = leadInstance2.Id,
            Subject = 'Other',
            Disposition__c = 'HANG UP',
            RecordTypeId = dispositionRTId 
        )
        };
        insert taskList;
        
        Datetime dt = Datetime.now();
        System.debug('0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?');
        String jobId = System.schedule(
            'Schedule Redial call cadence batch', 
            '0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?', 
            new ScheduleFive9CallCadence()
        ); 
        Test.stopTest();        
        CronTrigger job = [SELECT Id, CronJobDetail.Id, CronJobDetail.JobType, TimesTriggered FROM CronTrigger WHERE id = :jobId];
        System.assertEquals(0, job.TimesTriggered);
        System.assertEquals(1, [SELECT COUNT() FROM CronJobDetail WHERE Id = :job.CronJobDetail.Id AND JobType = '7']);
        System.assertNotEquals([SELECT Id, Name FROM Lead WHERE Archived_Date__c != Null AND Is_Archived__c != Null],Null);
              
    }
    
     @IsTest
    static void setRedialTimeFail(){    
        Id ProfileId = [SELECT Id,Name FROM Profile WHERE Name = 'Debt Negotiator' ][0].Id;
        user closerUser = DataFactoryTest.createUser(ProfileId);
        insert closerUser;
        
        Id dispositionRTId = TaskUtil.getRecordTypeId('Disposition');
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        insert oppInstance;
        
        Contact conInstance = DataFactoryTest.createContact();       
        insert conInstance;
        
        Sync_Redial_Time__c syncRedialTime = DataFactoryTest.createSyncRedialTime();
        insert syncRedialTime;
        
        Lead leadInstance = new Lead(
            FirstName='Test', LastName='Lead Julia', Email='julia.sample@company.com', Phone='4166661216', Status='Open - Not Contacted', Call_counter__c=4
        ); 
        
        Lead leadInstance2 = new Lead(
            FirstName='Test', LastName='Lead Julia', Email='julia.sample@company.com', Phone='4166661215', Status='NO ANSWER', Call_counter__c=4
        );    
                
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        insert leadInstance;
        insert leadInstance2;
        List<Task> taskList = new List<Task>{ new Task(
            whoId = leadInstance.Id,
            Subject = 'Other',
            Disposition__c = 'CALL TRANSFERRED',
            RecordTypeId = dispositionRTId 
        ),new Task(
            WhatId = oppInstance.Id,
            Subject = 'Meeting',
            Disposition__c = 'CALL TRANSFERRED',
            RecordTypeId = dispositionRTId 
        ),new Task(
            WhoId= conInstance.Id,
            Subject = 'Call Transferred',
            Disposition__c = 'CALL TRANSFERRED',
            RecordTypeId = dispositionRTId 
        ),new Task(
            whoId = leadInstance2.Id,
            Subject = 'Other',
            Disposition__c = 'HANG UP',
            RecordTypeId = dispositionRTId 
        )
        };
        insert taskList;
        String jobId;
        Datetime dt = Datetime.now();
        System.debug('0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?');
        System.runAs(closerUser){
        jobId = System.schedule(
            'Schedule Redial call cadence batch', 
            '0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?', 
            new ScheduleFive9CallCadence()
        ); 
        }
        Test.stopTest();        
        CronTrigger job = [SELECT Id, CronJobDetail.Id, CronJobDetail.JobType, TimesTriggered FROM CronTrigger WHERE id = :jobId];
        System.assertEquals(0, job.TimesTriggered);
        System.assertEquals(1, [SELECT COUNT() FROM CronJobDetail WHERE Id = :job.CronJobDetail.Id AND JobType = '7']);
        System.assertNotEquals([SELECT Id, Name FROM Lead WHERE Archived_Date__c != Null AND Is_Archived__c != Null],Null);
              
    }
    
    @isTest
    public static void redialCadenceMappingAllTestQuery(){
      Map<String, Redial_Cadence__mdt> redailCandenceMapping = Batch_Five9CallCadence.redialCadenceMappingAll();
      System.assertNotEquals(redailCandenceMapping,Null);
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
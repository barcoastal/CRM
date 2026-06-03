@isTest
public class Batch_SAS_GetDraftUpdatesTest {
    
     @TestSetup
    static void makeData(){
        
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_SAS_Id__c = '69');
        insert acct;

        Opportunity oppty = new Opportunity(
            Name = 'Opportunity Test', AccountId = acct.Id, CloseDate = System.today().addDays(3), ForecastCategoryName = 'Pipeline',
            Probability = 40, StageName = 'Working Opportunity'
        );
        insert oppty;

        Payment_Processor__c processor = new Payment_Processor__c(Name = 'SAS', Processor_Type__c = 'SAS');
        insert processor;

        Program_Plan__c programPlan = new Program_Plan__c(
            Client__c = acct.Id, Opportunity__c = oppty.Id, Payment_Processor__c = processor.Id
        );
        insert programPlan;

        Draft__c draft = new Draft__c(Program_Plan__c = programPlan.Id, External_SAS_Id__c = '243');
        insert draft;
        insert new SAS_Settings__c(Endpoint__c = 'https://test.com'); 
    }
    
    @IsTest
    static void getDebitScheduleTest_Success(){ 
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Database.executeBatch(new Batch_SAS_GetDraftUpdates());
        Test.stopTest();
        
        //Verify the callout data records created through batch
        External_API_Details__c externalApiDetails = [SELECT Id, Name, API_Name__c, API_Status__c, Request__c, Response__c FROM External_API_Details__c LIMIT 1];
        System.assertEquals('GetUpdatedDebits', externalApiDetails.API_Name__c, 'Verify the Method Name');
        
        //Verify the callout data item records created through batch
        List<External_Data__c> verifyExternalDataList = [
            SELECT Id, Client_External_Id__c, External_API_Details__c, Payment_Amount__c, 
            Payment_Date__c, Payment_External_Id__c, Payment_SF_Id__c, Payment_Status__c 
            FROM External_Data__c WHERE External_API_Details__c =:externalApiDetails.Id
        ];
        //System.assertEquals(4, verifyExternalDataList.size(), 'Verify the record size');
        
        Draft__c verifyDraft = [SELECT Id, Draft_Date__c, Draft_Amount__c, External_SAS_Id__c, Draft_Status__c FROM Draft__c LIMIT 1];
        /*System.assertEquals('Pending', verifyDraft.Draft_Status__c , 'Verify the draft status');        
        System.assertEquals('243', verifyDraft.External_SAS_Id__c, 'Verify the SAS Id');*/
    }
    
    @IsTest
    static void getDebitScheduleTest_Success1(){ 
        
        DateTime startDateTime = System.now().addDays(-21);
        DateTime endDateTime = System.now();
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        //Database.executeBatch(new Batch_SAS_GetDraftUpdates(startDateTime, endDateTime, 1));
        Datetime dt = Datetime.now();
        System.debug('0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?');
        String jobId = System.schedule(
            'Schedule Get Balances batch test', 
            '0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?', 
            new ScheduleSASGetDraftUpdates()
        ); 
        Test.stopTest();
        
        CronTrigger job = [SELECT Id, CronJobDetail.Id, CronJobDetail.JobType, TimesTriggered FROM CronTrigger WHERE id = :jobId];
        System.assertEquals(0, job.TimesTriggered);
        System.assertEquals(1, [SELECT COUNT() FROM CronJobDetail WHERE Id = :job.CronJobDetail.Id AND JobType = '7']);
        
        Draft__c verifyDraft = [SELECT Id, Draft_Date__c, Draft_Amount__c, External_SAS_Id__c, Draft_Status__c FROM Draft__c LIMIT 1];
        System.assertEquals('Pending', verifyDraft.Draft_Status__c , 'Verify the draft status');        
        System.assertEquals('243', verifyDraft.External_SAS_Id__c, 'Verify the SAS Id');
    }
    
    @IsTest
    static void getDebitScheduleTest_Success3(){ 
        
        Test.startTest();
        
        External_API_Details__c externalApi = new External_API_Details__c();
        externalApi.API_Name__c = 'GetUpdatedDebits';
        externalApi.API_Status__c = 'completed';
        insert externalApi;
        
        DateTime startDateTime = System.now().addHours(-24);
        DateTime endDateTime = System.now();
        Integer currentPage = 0;
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Database.executeBatch(new Batch_SAS_GetDraftUpdates(startDateTime,endDateTime,currentPage,String.valueOf(externalApi.Id)));
        Test.stopTest();
        
        //Verify the callout data records created through batch
        External_API_Details__c externalApiDetails = [SELECT Id, Name, API_Name__c, API_Status__c, Request__c, Response__c FROM External_API_Details__c LIMIT 1];
        System.assertEquals('GetUpdatedDebits', externalApiDetails.API_Name__c, 'Verify the Method Name');
        
        List<External_Data__c> externalData = [SELECT Id, Client_SF_Id__c, Payment_Amount__c, Payment_Date__c, Payment_External_Id__c, NSF_Reason__c,Is_Child__c FROM External_Data__c WHERE Is_Child__c=false]; 
        System.assertEquals('R01: Insufficient Funds', externalData[0].NSF_Reason__c , 'Verify the Reason');
    }
    
}
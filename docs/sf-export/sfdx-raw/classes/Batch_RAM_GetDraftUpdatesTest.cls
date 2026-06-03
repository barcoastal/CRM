@isTest
public class Batch_RAM_GetDraftUpdatesTest {
    
     @TestSetup
    static void makeData(){
        
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_RAM_Id__c = '51369',
        Escrow_Balance_Pulled_Date_Time__c = System.now().addDays(-8));
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

        Draft__c draft = new Draft__c(Program_Plan__c = programPlan.Id, External_RAM_Id__c = '63423824');
        insert draft;
        
        List<RAM_Payment_Status_Mapping__mdt> paymentStatuMap = DataFactoryTest.createRAMPaymenteStatusMapping();
                
        RAMS_Settings__c settings = new RAMS_Settings__c();
        settings.Name = 'RAM Settings';
        settings.Endpoint__c = 'https://example.com/api';
        settings.APIKey__c = 'testApiKey';
        settings.Affiliate_ID__c = '1234';
        settings.Fee_Split_Group_ID__c = '1234';
        insert settings;
    }
    
    @IsTest
    static void scheduleRAMTest(){ 
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
         Datetime dt = Datetime.now();
        System.debug('0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?');
        String jobId = System.schedule(
            'Schedule Get Balances batch test', 
            '0 ' + dt.addMinutes(1).minuteGmt() + ' ' + dt.hourGmt() + ' ' + dt.dayGmt() + ' ' + dt.monthGmt() + ' ?', 
            new ScheduleRAMGetDraftUpdates()
        ); 
        Test.stopTest();
        
        CronTrigger job = [SELECT Id, CronJobDetail.Id, CronJobDetail.JobType, TimesTriggered FROM CronTrigger WHERE id = :jobId];
        System.assertEquals(0, job.TimesTriggered);
        System.assertEquals(1, [SELECT COUNT() FROM CronJobDetail WHERE Id = :job.CronJobDetail.Id AND JobType = '7']);
    } 
    
    @IsTest
    static void getDraftUpdatesSuccess(){ 
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        Database.executeBatch(new Batch_RAM_GetDraftUpdates());
        Test.stopTest();
        
        //Verify the callout data records created through batch
        External_API_Details__c externalApiDetails = [SELECT Id, Name, API_Name__c, API_Status__c, Request__c, Response__c FROM External_API_Details__c LIMIT 1];
        System.assertEquals('GetClientTransactionsByUpdateDate', externalApiDetails.API_Name__c, 'Verify the Method Name');
    } 
    
    @IsTest
    static void getDraftUpdatesFailure(){ 
        String fromDate = Datetime.now().addDays(-1).format('yyyy-MM-dd');        
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_RAM_Id__c = '75269');
        insert acct;
        Test.startTest();        
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        Database.executeBatch(new Batch_RAM_GetDraftUpdates(fromDate, 1));         
        Test.stopTest();
        //Verify the callout data records created through batch
        External_API_Details__c externalApiDetails = [SELECT Id, Name, API_Name__c, API_Status__c, Request__c, Response__c FROM External_API_Details__c LIMIT 1];
        System.assertEquals('GetClientTransactionsByUpdateDate', externalApiDetails.API_Name__c, 'Verify the Method Name');
        
        //Verify the callout data item records created through batch
        List<External_Data__c> verifyExternalDataList = [
            SELECT Id, Client_External_Id__c, External_API_Details__c, Payment_Amount__c,Error_Message__c, 
            Payment_Date__c, Payment_External_Id__c, Payment_SF_Id__c, Payment_Status__c,Processing_Status__c 
            FROM External_Data__c WHERE External_API_Details__c =:externalApiDetails.Id
        ];
        System.assertEquals(1, verifyExternalDataList.size(), 'Verify the record size');
        
    } 
    
    @IsTest
    static void getDraftUpdatesFailure1(){ 
        String fromDate = Datetime.now().addDays(-1).format('yyyy-MM-dd');        
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_RAM_Id__c = '75269');
        insert acct;
        Test.startTest();        
        Database.executeBatch(new Batch_RAM_GetDraftUpdates(fromDate, 1));         
        Test.stopTest();
        
        List<Application_Log__c> log = [SELECT Id, Exception_Message__c, Statement__c, Log_Type__c, Record_Id__c FROM Application_Log__c LIMIT 1];
        System.assertEquals(1, log.size(), 'Verify the record size');
    } 
}
@isTest
public class Batch_SAS_ProcessDraftUpdatesTest {
    
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

        Payment_Processor__c processor = new Payment_Processor__c(Name = 'SAS', Processor_Type__c = 'SAS',Retainer_Fee_Payee_Id__c = '15',Service_Fee_Payee_Id__c = '10' 
                                                                 ,Citadel_Fee_Payee_Id__c = '13',Program_Fee_Payee_Id__c = '12',Setup_Fee_Payee_Id__c = '16');
        insert processor;

        Program_Plan__c programPlan = new Program_Plan__c(
            Client__c = acct.Id, Opportunity__c = oppty.Id, Payment_Processor__c = processor.Id
        );
        insert programPlan;

        Draft__c draft = new Draft__c(Program_Plan__c = programPlan.Id, External_SAS_Id__c = '243');
        insert draft;
        
        insert new SAS_Settings__c(Endpoint__c = 'https://test.com'); 
        
        List<SAS_Payment_Status_Mapping__mdt> paymentStatuMap = DataFactoryTest.createSASPaymenteStatusMapping();
    }
    
    @IsTest
    static void getDebitScheduleTest_Success(){ 
        
        External_API_Details__c externalApi = new External_API_Details__c();
        externalApi.API_Name__c = 'GetUpdatedDebits';
        externalApi.API_Status__c = 'completed';
        insert externalApi;
        
        Draft__c draftRec = [SELECT Id, Draft_Date__c, Draft_Amount__c, Draft_Status__c FROM Draft__c LIMIT 1];
        
        External_Data__c exData = new External_Data__c();
        exData.External_API_Details__c = externalApi.Id;
        exData.Payment_Amount__c = '500';
        exData.Payment_External_Id__c = '244';
        exData.Payment_Status__c = 'Successful';
        exData.Payment_SF_Id__c = draftRec.Id;
        insert exData;
        
        External_Data__c exData1 = new External_Data__c();
        exData1.External_API_Details__c = externalApi.Id;
        exData1.Payment_Amount__c = '500';
        exData1.Payment_External_Id__c = '243';
        exData1.Payment_Status__c = 'Pending';
        insert exData1;
        
        External_Data__c exData3 = new External_Data__c();
        exData3.External_API_Details__c = externalApi.Id;
        exData3.Payment_Amount__c = '500';
        exData3.Payment_Status__c = 'Pending';
        insert exData3;
        
        External_Data__c exData2 = new External_Data__c();
        exData2.External_API_Details__c = externalApi.Id;
        exData2.Payment_Amount__c = '500';
        exData2.Payment_External_Id__c = '343';
        exData2.Client_External_Id__c = '15';
        exData2.Client_SF_Id__c = '243';
        exData2.Payment_Status__c = 'Pending';
        exData2.Is_Child__c = true;
        insert exData2;
        
        Test.startTest();
        Database.executeBatch(new Batch_SAS_ProcessDraftUpdates(externalApi.Id));
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
        System.assertEquals(4, verifyExternalDataList.size(), 'Verify the record size');
    }
    
    @IsTest
    static void getDebitScheduleTest_Exception(){
    try {
            Test.startTest();        
            Database.executeBatch(new Batch_SAS_ProcessDraftUpdates(null));        
            Test.stopTest();
        } catch (CustomException exp) {
            System.assertEquals('External API Details Id is required to execute the batch', exp.getMessage(), 'Exception is not valid');
        }
    } 
}
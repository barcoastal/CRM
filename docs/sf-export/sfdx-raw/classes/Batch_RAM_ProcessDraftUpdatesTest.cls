@isTest
public class Batch_RAM_ProcessDraftUpdatesTest {
    
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
        
        Draft__c draft1 = new Draft__c(Program_Plan__c = programPlan.Id, External_RAM_Id__c = '6342382');
        insert draft1;
        
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
    static void getProcessDraft_Success(){ 
        
        External_API_Details__c externalApi = new External_API_Details__c();
        externalApi.API_Name__c = 'GetClientTransactionsByUpdateDate';
        externalApi.API_Status__c = 'completed';
        insert externalApi;
        
        Draft__c draftRec = [SELECT Id, Draft_Date__c, Draft_Amount__c, Draft_Status__c,External_RAM_Id__c FROM Draft__c LIMIT 1];
        
        External_Data__c exData = new External_Data__c();
        exData.External_API_Details__c = externalApi.Id;
        exData.Payment_Amount__c = '500';
        exData.Payment_External_Id__c = '63423824';
        exData.Payment_Status__c = 'VOIDED';
        insert exData;
        
        External_Data__c exData1 = new External_Data__c();
        exData1.External_API_Details__c = externalApi.Id;
        exData1.Payment_Amount__c = '500';
        exData1.Payment_External_Id__c = '6342382';
        exData1.Payment_Status__c = 'REFUNDED';
        insert exData1;
        
        External_Data__c exData2 = new External_Data__c();
        exData2.External_API_Details__c = externalApi.Id;
        exData2.Payment_Amount__c = '500';
        exData2.Payment_External_Id__c = '634238';
        exData2.Payment_Status__c = 'REFUNDED';
        insert exData2;
        
        Test.startTest();
        Database.executeBatch(new Batch_RAM_ProcessDraftUpdates(externalApi.Id));
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
        System.assertEquals(3, verifyExternalDataList.size(), 'Verify the record size');
        System.assertEquals('Skipped', verifyExternalDataList[1].Processing_Status__c, 'Verify the draft status');
        System.assertEquals('Draft status not available in salesforce.', verifyExternalDataList[1].Error_Message__c, 'Verify the draft status');
        System.assertEquals('Failed', verifyExternalDataList[2].Processing_Status__c, 'Verify the draft record');
        System.assertEquals('This draft is not available in salesforce.', verifyExternalDataList[2].Error_Message__c, 'Verify the draft record');
    }
}
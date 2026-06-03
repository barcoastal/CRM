@isTest
public class Batch_SAS_GetEscrowBalanceTest {
    
     @TestSetup
    static void makeData(){
        
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_SAS_Id__c = '69',
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

        Draft__c draft = new Draft__c(Program_Plan__c = programPlan.Id, External_SAS_Id__c = '243');
        insert draft;
        insert new SAS_Settings__c(Endpoint__c = 'https://test.com'); 
    }
    
    @IsTest
    static void getEscrowBalance(){ 
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Database.executeBatch(new Batch_SAS_GetEscrowBalance());
        Test.stopTest();
    } 
    
    @IsTest
    static void getEscrowBalance1(){ 
        String query = 'SELECT Id, External_SAS_Id__c,Client_Status__c FROM Account WHERE External_SAS_Id__c != null AND Escrow_Balance_Pulled_Date_Time__c < LAST_N_DAYS:7';
        Test.startTest();
        //Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        System.schedule('Schedule Archive Dupe Leads', '0 0 2 * * ? *', new Batch_SAS_GetEscrowBalance(query,1));
        Test.stopTest();
    } 
}
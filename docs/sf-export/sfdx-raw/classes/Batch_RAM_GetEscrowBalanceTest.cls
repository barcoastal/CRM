@isTest
public class Batch_RAM_GetEscrowBalanceTest {
    
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

        Draft__c draft = new Draft__c(Program_Plan__c = programPlan.Id, External_RAM_Id__c = '243');
        insert draft;
                
        RAMS_Settings__c settings = new RAMS_Settings__c();
        settings.Name = 'RAM Settings';
        settings.Endpoint__c = 'https://example.com/api';
        settings.APIKey__c = 'testApiKey';
        settings.Affiliate_ID__c = '1234';
        settings.Fee_Split_Group_ID__c = '1234';
        insert settings;
    }
    
    @IsTest
    static void getEscrowBalance(){ 
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        Database.executeBatch(new Batch_RAM_GetEscrowBalance());        
        Test.stopTest();
        Account acc = [SELECT Id, External_RAM_Id__c, Escrow_Balance__c FROM Account Limit 1];
        System.assertEquals('51369', acc.External_RAM_Id__c, 'Verified account RAM Id');
        System.assertEquals(257.640, acc.Escrow_Balance__c , 'Verified account Escrow Balance');
    } 
    
    @IsTest
    static void getEscrowBalance1(){ 
        String fromDate = Datetime.now().addDays(-1).format('yyyy-MM-dd');        
        Id personAcctRecTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount');
        Account acct = new Account(RecordTypeId = personAcctRecTypeId, FirstName = 'Nyssa', LastName = 'Vazquez', External_RAM_Id__c = '75269');
        insert acct;
        
        Test.startTest();        
        Test.setMock(HttpCalloutMock.class, new RAMMockHttpResponseHandler());
        System.schedule('Schedule Get RAM EscrowBalance', '0 0 2 * * ? *', new Batch_RAM_GetEscrowBalance(fromDate, 0));        
        Test.stopTest();
        
        Account verifyAccount = [SELECT Id, External_RAM_Id__c, Escrow_Balance__c FROM Account WHERE External_RAM_Id__c = '75269'];
        System.assertEquals('75269', verifyAccount.External_RAM_Id__c, 'Verified account RAM Id');
    } 
}
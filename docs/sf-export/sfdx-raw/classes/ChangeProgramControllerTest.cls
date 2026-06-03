@isTest
public class ChangeProgramControllerTest {
    @isTest
    static void getRTDetailsOfOpportunityRecord() { 
        ApexActionResult result;
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;
        
        Opportunity oppRec = DataFactoryTest.createOpportunity();
        oppRec.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity', 'Debt_Settlement');
        oppRec.AccountId = acctRecord.Id;
        insert oppRec;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        result = ChangeProgramController.getOpportunityRelatedData(oppRec.Id);
        Test.stopTest();
        String recordDetailsString = String.valueOf(result.data);
        ChangeProgramController.ChangeProgramWrapper paymentCalcElementWrapper = (ChangeProgramController.ChangeProgramWrapper)JSON.deserialize(recordDetailsString, ChangeProgramController.ChangeProgramWrapper.class);
        System.assertEquals(null,  paymentCalcElementWrapper.setCustomerStatus);
    }
    
    @isTest
    static void setCustomerStatus() {
        ApexActionResult result;
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.client_Status__c = 'Pending Cancellation';
        insert acctRecord;
        try{
        Test.startTest();
        result = ChangeProgramController.setCustomerStatus(acctRecord.Id);
        Test.stopTest();
        }catch(Exception ex){
            //System.assertEquals('Client Status update not allowed. The selected transition is invalid.', ex.getMessage());
        }
    }
    
    @isTest
    static void FailsetCustomerStatus() {
        ApexActionResult result;
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.client_Status__c = 'Active';
        insert acctRecord;
        try{
        Test.startTest();
        result = ChangeProgramController.setCustomerStatus(acctRecord.Id);
        Test.stopTest();
        }catch(Exception ex){
            //System.assertEquals('Client Status update not allowed. The selected transition is invalid.', ex.getMessage());
        }
    }
    
    @isTest
    static void changeProgram() {
        ApexActionResult result;
        
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.External_RAM_Id__c = '1233';
        insert acctRecord;
        
        Opportunity oppRec = DataFactoryTest.createOpportunity();
        oppRec.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity', 'Debt_Settlement');
        oppRec.AccountId = acctRecord.Id;
        insert oppRec;
        
        Map<String,Object> changeProgramMap = new Map<String, Object>{
            'opportunityDetails' => oppRec,
            'accountDetails' => acctRecord
        };
        
        String buyoutRecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity', 'Buyout');
        Test.startTest();
        String changeProgram = JSON.serialize(changeProgramMap);
        result = ChangeProgramController.changeProgram(changeProgram , true , buyoutRecordTypeId, 'Debt_Settlement', 'Buyout');
        Test.stopTest();
        Opportunity opp = [SELECT Id,RecordtypeId FROM Opportunity Limit 1];
        //System.assertEquals(buyoutRecordTypeId, opp.recordtypeId);
    }
    
    @isTest
    static void changeProgram1() {
        ApexActionResult result;
        
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;
        
        Opportunity oppRec = DataFactoryTest.createOpportunity();
        oppRec.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity', 'Debt_Settlement');
        oppRec.AccountId = acctRecord.Id;
        insert oppRec;
        
        Map<String,Object> changeProgramMap = new Map<String, Object>{
            'opportunityDetails' => oppRec,
            'accountDetails' => acctRecord
        };
        
        String restructureRecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity', 'Restructure_Program');
        Test.startTest();
        String changeProgram = JSON.serialize(changeProgramMap);
        result = ChangeProgramController.changeProgram(changeProgram , true , restructureRecordTypeId, 'Debt_Settlement', 'Restructure_Program');
        Test.stopTest();
        Opportunity opp = [SELECT Id,RecordtypeId FROM Opportunity Limit 1];
        //System.assertEquals(restructureRecordTypeId, opp.recordtypeId);
    }
}
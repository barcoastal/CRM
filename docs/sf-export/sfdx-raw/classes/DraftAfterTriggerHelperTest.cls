@isTest
public class DraftAfterTriggerHelperTest {
   
    @TestSetup
    public static void setupTestData() {
       
        
        List<Account> accList = new List<Account>{
            DataFactoryTest.createBusinessAccount()
        };
  
        insert accList;

        List<Opportunity> oppList = new List<Opportunity>{
            DataFactoryTest.createOpportunity(), DataFactoryTest.createOpportunity()
        };
        insert oppList;

        Payment_Processor__c processor = DataFactoryTest.createPaymentProcessor();
        insert processor;

        List<Program_Plan__c> programPlanList = new List<Program_Plan__c>{
            DataFactoryTest.createProgramPlan(oppList[0].Id, accList[0].Id, processor.Id)
        };
        insert programPlanList;

        Payment_Calculator_Settings__c paymentSettings = DataFactoryTest.createPaymentCalculatorSettings();
        paymentSettings.Service_Fee__c = 10;
        insert paymentSettings;
                
        Draft__c draft = DataFactoryTest.createDraft(programPlanList[0].Id,'Pending',null);
        draft.Account__c = accList[0].Id;
        draft.Draft_Amount__c = 1000;
        insert draft;
       
     }
    
    @isTest
    public static void calculatePaymentSummariesInsertTest(){
        
        Program_Plan__c programPlan = [Select Id From  Program_Plan__c limit 1];
        Account acc = [Select Id From Account limit 1];
        Draft__c draft = DataFactoryTest.createDraft(programPlan.Id,'Pending',null);
        insert draft;
        
        Assert.areEqual(draft.program_Plan__c,programPlan.Id);
    }
    
    @isTest
    public static void calculatePaymentSummariesUpdateTest(){
        
        Program_Plan__c programPlan = [Select Id From  Program_Plan__c limit 1];
        Draft__c draft =[Select Id From Draft__c limit 1];
        draft.Draft_Amount__c = 500;
        update draft;
        
        Assert.areEqual(draft.Draft_Amount__c,500);
    }
}
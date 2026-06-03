@IsTest
public class InvocablePaymentSummaryUpdateTest {

    @TestSetup
    static void makeData(){
        Account account = new Account(Name = 'Test Account', Client_Status__c='First Payment Pending');
        insert account;

        Opportunity opp = new Opportunity(Name = 'Test Opportunity', AccountId = account.Id, CloseDate = Date.today(), StageName = 'Prospecting');
        insert opp;

        Payment_Processor__c paymentProcessor = DataFactoryTest.createPaymentProcessor();
        insert paymentProcessor;

        Program_Plan__c programPlan = new Program_Plan__c(Client__c = account.Id, Opportunity__c = opp.Id, Settlement_Program_Fee__c = 50,Payment_Processor__c = paymentProcessor.Id
                                                         ,Settlement_Percentage__c = '45' , Total_Debt__c = 100000,Weekly_Draft_Amount__c = 1000);
        insert programPlan;
        
        Debt_Details__c debtDetail = new Debt_Details__c(Account__c = account.Id, Opportunity__c = opp.Id, Debt_Amount__c = 1000,Program_Plan__c = programPlan.Id);
        insert debtDetail;
        
        Offer__c offer = new Offer__c(Opportunity__c = opp.Id, Offer_Status__c = 'Accepted',Payment_Method__c = 'Wire',Payment_Method_Amount__c = 15,Debt_Details__c = debtDetail.Id,
                                     Total_Settlement_Amount__c = 500, Settlement_Frequency__c = 'Monthly' ,Settlement_Term__c = '6',offer_Amount__c = 400);
        insert offer;
                
        Draft__c draft = DataFactoryTest.createDraft(programPlan.Id,'Pending',null);
        insert draft;
       
        Id recId = SettlementUtil.getRecordTypeId(SettlementUtil.RT_SETTLEMENTS);
        
        Settlement__c settlement = new Settlement__c(Offer__c = offer.Id,RecordTypeId = recId,Opportunity__c = opp.Id);
        insert settlement; 
 
    }

    @IsTest
    static void testUpdateAccountFeeStatus() {
        List<Account> accList = [SELECT Id FROM Account LIMIT 1];
        List<Draft__c> draftRecords = [SELECT Id,Draft_Status__c FROM Draft__c];
        draftRecords[0].Draft_Status__c = 'Completed';
        update draftRecords;

        List<Id> accountIds = new List<Id>{ accList[0].Id };
        List<List<Id>> invocableInput = new List<List<Id>>{ accountIds };
        Test.startTest();
        	InvocablePaymentSummaryUpdate.updateAccountFeeStatus(invocableInput);
        Test.stopTest();
        List<Account> accRecords = [SELECT Id, Fee_Paid_in_Full__c FROM Account LIMIT 1];
        System.assertEquals(accRecords[0].Fee_Paid_in_Full__c, false);
    }
}
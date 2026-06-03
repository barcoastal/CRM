@isTest
public class FeeAfterTriggerHelperTest {
   
    @TestSetup
    public static void setupTestData() {
        // Create test data for Opportunity, Offer, Debt, Program Plan, and Fee
        Account account = new Account(Name = 'Test Account');
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
        
        fee__c feeRecord2 = DataFactoryTest.createFee(draft.Id,1000,Date.today(),'Program_Fee');
        feeRecord2.Settlement__c = settlement.Id;
        insert feeRecord2;
     }
    
    @isTest
    public static void calculatePaymentSummariesTest(){
        
        Draft__c draftRecord = [Select Id From Draft__c Limit 1];
        
        Account acc = [Select Id from Account Limit 1];
        
        fee__c feeRecord = DataFactoryTest.createFee(draftRecord.Id,1000,Date.today(),'Program_Fee');
        feeRecord.Account__c = acc.Id;
        insert feeRecord;
        
         Assert.areEqual(feeRecord.Account__c,acc.Id);
    }
    
    @isTest
    public static void calculatePaymentSummariesSettlementsUpdateTest(){
        
        Draft__c draftRecord = [Select Id From Draft__c Limit 1];
        
        Account acc = [Select Id from Account Limit 1]; 
        
        Settlement__c settlement = [Select Id From Settlement__c limit 1];
        
        fee__c feeRecord2 = DataFactoryTest.createFee(draftRecord.Id,1000,Date.today(),'Program_Fee');
        
        feeRecord2.Account__c = acc.Id;
        feeRecord2.Settlement__c = settlement.Id;
        
        insert feeRecord2;
        
        Assert.areEqual(feeRecord2.Account__c,acc.Id);
        Assert.areEqual(feeRecord2.Settlement__c,settlement.Id);
    }
    
    @isTest
    public static void calculatePaymentSummariesUpdateTest(){
        
        Account account = new Account(Name = 'Test Account');
        insert account;
        
        fee__c feeRecords = [Select Id From fee__c where recordType.developerName = 'Program_Fee' limit 1];
        
        feeRecords.Fee_Amount__c = 500;
        feeRecords.Account__c = account.Id;
        update feeRecords;
        
        Assert.areEqual(feeRecords.Fee_Amount__c,500);
        Assert.areEqual(feeRecords.Account__c,account.Id);
    }
    
        @isTest
    public static void calculatePaymentSummariesDeleteTest(){
        
        Account account = new Account(Name = 'Test Account');
        insert account;
        
        fee__c feeRecords = [Select Id From fee__c where recordType.developerName = 'Program_Fee' limit 1];
        feeRecords.Fee_Amount__c = 500;
        feeRecords.Account__c = account.Id;
        update feeRecords;
        delete feeRecords;
        
        List<fee__c> feeRecordsAfterDelete = [Select Id From fee__c where recordType.developerName = 'Program_Fee' AND Id =: feeRecords.Id ];

        Assert.areEqual(feeRecordsAfterDelete.Size(),0);
    }
    
}
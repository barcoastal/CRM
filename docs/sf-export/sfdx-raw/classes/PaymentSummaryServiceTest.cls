@isTest
public class PaymentSummaryServiceTest {
   
    @TestSetup
    public static void setupTestData() {
        
        Account account = new Account(Name = 'Test Account');
        insert account;

        Opportunity opp = new Opportunity(Name = 'Test Opportunity', AccountId = account.Id, CloseDate = Date.today(), StageName = 'Closed Won First Payment Pending', Legal_Network__c = FileUtil.AGREEMENT_VICTORY);
        insert opp;

        Fee__c fee = new Fee__c(Opportunity__c = opp.Id, Fee_Amount__c = 100, Fee_Status__c = 'Pending');
        insert fee;
         
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
        
        Id recId = SettlementUtil.getRecordTypeId(SettlementUtil.RT_SETTLEMENTS);
        
        Draft__c draft = DataFactoryTest.createDraft(programPlan.Id,'Pending',null);
        draft.Draft_Amount__c = 1000;
        insert draft;
        
        Payment_Calculator_Settings__c paymentSettings = DataFactoryTest.createPaymentCalculatorSettings();
        paymentSettings.Service_Fee__c = 10;
        insert paymentSettings;
    
     }
    
    @isTest
    public static void createPaymentSummariesTest(){
        
        Account acc = [SELECT Id FROM Account LIMIT 1];
        
        PaymentSummaryService.createPaymentSummaries(new Set<Id> {acc.Id},null);
        List<Payment_Summary__c> paymentSummaryProgramFee = [Select Id,Name ,Total_Amount__c,Payment_Type__c From Payment_Summary__c Where Payment_Type__c =: PaymentSumaryUtil.PAYMENT_TYPE_PROGRAM_FEE and Client__c =: acc.Id];
        List<Payment_Summary__c> paymentSummaryRetainerFee = [Select Id,Name ,Total_Amount__c,Payment_Type__c From Payment_Summary__c Where Payment_Type__c =: PaymentSumaryUtil.PAYMENT_TYPE_RETAINER_FEE and Client__c =: acc.Id];
         List<Payment_Summary__c> paymentSummarySetupFee = [Select Id,Name ,Total_Amount__c,Payment_Type__c From Payment_Summary__c Where Payment_Type__c =: PaymentSumaryUtil.PAYMENT_TYPE_SETUP_FEE and Client__c =: acc.Id];
        
        SetupFee__mdt expectedSetupFee = [SELECT Fee__c FROM SetupFee__mdt WHERE Type__c = :FileUtil.AGREEMENT_VICTORY AND Legal_Plan_Required__c = false LIMIT 1];
        Assert.areEqual(paymentSummaryProgramFee[0].Total_Amount__c ,20000);
        Assert.areEqual(paymentSummaryRetainerFee[0].Total_Amount__c ,10000);
        Assert.areEqual(paymentSummarySetupFee[0].Total_Amount__c, expectedSetupFee.Fee__c);

    }
}
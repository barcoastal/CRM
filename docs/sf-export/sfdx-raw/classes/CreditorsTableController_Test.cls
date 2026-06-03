@isTest
public class CreditorsTableController_Test {
    
    @testSetup
    public static void testData(){
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


    }
    
    @isTest
    public static void getCreditorsDetailsTest(){
        Opportunity opp = [SElECT id From Opportunity Limit 1];
        CreditorsTableController.getCreditorsDetails(opp.id);
    }
    
    @isTest
    public static void getOffersListOfCreditorTest(){
        Debt_Details__c debtDetail = [SELECT id From Debt_Details__c limit 1];
        CreditorsTableController.getOffersListOfCreditor(debtDetail.Id);
    }
    
    @isTest
    public static void createNewOfferInstanceTest(){
        Debt_Details__c debtDetail = [SELECT id From Debt_Details__c limit 1];
        CreditorsTableController.createNewOfferInstance(debtDetail.Id);
    }
    
     @isTest
    public static void getOfferDetailsTest(){
        Offer__c Offer = [SELECT id From Offer__c limit 1];
        CreditorsTableController.getOfferDetails(Offer.Id);
    }
}
@isTest
public class SettlementPaymentsControllerTest {

    // Define wrapper classes here (if they are not defined elsewhere)
    public class PaymentWrapper {
        public String recordId;
        public String opportunityId;
        public String accountId;
        public Date paymentDate;
        public String paymentType;
        public String paymentRecipient;
        public Decimal totalAmount;
        public Decimal amount;
        public String paymentStatus;
    }

  

    public class OfferAndPaymentsWrapper {
        public OfferWrapper offerWrap;
        public List<PaymentWrapper> paymentWrappers;
    }

    // Helper method to set up test data
    private static void setupTestData() {
        // Create test data for Opportunity, Offer, Debt, Program Plan, and Fee
        Account account = new Account(Name = 'Test Account');
        insert account;

        Opportunity opp = new Opportunity(Name = 'Test Opportunity', AccountId = account.Id, CloseDate = Date.today(), StageName = 'Prospecting');
        insert opp;

       

        Fee__c fee = new Fee__c(Opportunity__c = opp.Id, Fee_Amount__c = 100, Fee_Status__c = 'Pending');
        insert fee;
         
       Payment_Processor__c paymentProcessor = DataFactoryTest.createPaymentProcessor();
        insert paymentProcessor;

        Program_Plan__c programPlan = new Program_Plan__c(Client__c = account.Id, Opportunity__c = opp.Id, Settlement_Program_Fee__c = 50,Payment_Processor__c = paymentProcessor.Id
                                                         ,Settlement_Percentage__c = '45' , Total_Debt__c = 100000,Weekly_Draft_Amount__c = 1000);
        insert programPlan;

        Draft__c draftRecord = DataFactoryTest.createDraft(programPlan.Id);
        insert draftRecord;
        
          Debt_Details__c debtDetail = new Debt_Details__c(Account__c = account.Id, Opportunity__c = opp.Id, Debt_Amount__c = 1000,Program_Plan__c = programPlan.Id);
        insert debtDetail;
        
         Offer__c offer = new Offer__c(Opportunity__c = opp.Id, Offer_Status__c = 'Accepted',Payment_Method__c = 'Wire',Payment_Method_Amount__c = 15,Debt_Details__c = debtDetail.Id,
                                     Total_Settlement_Amount__c = 500, Settlement_Frequency__c = 'Monthly' ,Settlement_Term__c = '6',offer_Amount__c = 400);
        insert offer;
                 Offer__c offer1 = new Offer__c(Opportunity__c = opp.Id, Offer_Status__c = 'In Review',Payment_Method__c = 'Wire',Payment_Method_Amount__c = 15,Debt_Details__c = debtDetail.Id,
                                     Total_Settlement_Amount__c = 500, Settlement_Frequency__c = 'Monthly' ,Settlement_Term__c = '6',offer_Amount__c = 400);
        insert offer1;
        
        Id recId = SettlementUtil.getRecordTypeId(SettlementUtil.RT_SETTLEMENTS);
        
      /*  Settlement__c settlement = new Settlement__c(Offer__c = offer.Id,RecordTypeId = recId,Opportunity__c = opp.Id);
        insert settlement; */
    }

    @isTest
    static void testSimulateSettlements() {
        setupTestData(); // Setup test data
        
        Offer__c offer = [SELECT Id FROM Offer__c  LIMIT 1];
 

		// Query for the Opportunity
        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];


        // Query for the Account
        Account account = [SELECT Id FROM Account  LIMIT 1];
      

        // Query for the Debt Detail
        Debt_Details__c debtDetail = [SELECT Id FROM Debt_Details__c  LIMIT 1];
     
        
        // Creating a mock OfferWrapper object
        OfferWrapper offerWrap = new OfferWrapper();
        offerWrap.offerId = offer.Id;
        offerWrap.opportunityId = opp.Id;
        offerWrap.accountId = account.Id;
        offerWrap.debtDetailId = debtDetail.Id;
        offerWrap.paymentMethod = 'Wire';
        offerWrap.firstPaymentDate = '10';
        offerWrap.secondPaymentDate = '31';
        offerWrap.settlementFrequency = 'Twice Monthly';
        offerWrap.settlementTerm = '8';
        offerWrap.totalSettlementAmount = 500;
        offerWrap.offerAmount = 300;
        offerWrap.recurringDay = '1';
        offerWrap.settlementStartDate = Date.today();
        offerWrap.diffInAmount = 10000;
        offerWrap.draftAmountPerPayment = 190;
        
        String offerDetailsJson = JSON.serialize(offerWrap);

        // Call the simulateSettlements method
        Test.startTest();
        SettlementPaymentsController.getPayments(offerWrap);
        ApexActionResult result = SettlementPaymentsController.simulateSettlements(offerDetailsJson);
        Test.stopTest();

        // Verify the results
      //  System.assertNotEquals(null, result.data, 'Simulated settlements data should not be null');
    }

    @isTest
    static void testSaveOfferAndSettlements() {
        setupTestData(); // Setup test data

        // Create a mock OfferAndPaymentsWrapper
        OfferAndPaymentsWrapper offerAndPaymentsWrap = new OfferAndPaymentsWrapper();
          
        Offer__c offer = [SELECT Id FROM Offer__c  LIMIT 1];
 

		// Query for the Opportunity
        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];


        // Query for the Account
        Account account = [SELECT Id FROM Account  LIMIT 1];
      

        // Query for the Debt Detail
        Debt_Details__c debtDetail = [SELECT Id FROM Debt_Details__c  LIMIT 1];
        
        
        // Creating a mock OfferWrapper object
        OfferWrapper offerWrap = new OfferWrapper();
        offerWrap.offerId = offer.Id;
        offerWrap.opportunityId = opp.Id;
        offerWrap.accountId = account.Id;
        offerWrap.debtDetailId = debtDetail.Id;
        offerWrap.paymentMethod = 'Wire';
        offerWrap.settlementFrequency = 'Monthly';
        offerWrap.settlementTerm = '8';
        offerWrap.totalSettlementAmount = 500;
        offerWrap.offerAmount = 300;
        offerWrap.recurringDay = '1';
        offerWrap.settlementStartDate = Date.today();
       offerAndPaymentsWrap.offerWrap = offerWrap;
        offerAndPaymentsWrap.paymentWrappers = new List<PaymentWrapper>();

        // Create a mock PaymentWrapper
        PaymentWrapper paymentWrapper = new PaymentWrapper();
        paymentWrapper.opportunityId = opp.Id;
        paymentWrapper.accountId = account.Id;
        paymentWrapper.paymentDate = Date.today();
        paymentWrapper.paymentType = 'Settlement';
        paymentWrapper.paymentRecipient = 'Test Creditor';
        paymentWrapper.totalAmount = 500;
        paymentWrapper.amount = 400;
        paymentWrapper.paymentStatus = 'Simulated';
        
        PaymentWrapper paymentWrapper1 = new PaymentWrapper();
        paymentWrapper1.opportunityId = opp.Id;
        paymentWrapper1.accountId = account.Id;
        paymentWrapper1.paymentDate = Date.today();
        paymentWrapper1.paymentType = 'Additional Draft';
        paymentWrapper1.paymentRecipient = 'Test Creditor';
        paymentWrapper1.totalAmount = 500;
        paymentWrapper1.amount = 400;
        paymentWrapper1.paymentStatus = 'Simulated';
        offerAndPaymentsWrap.paymentWrappers.add(paymentWrapper);

        String offerAndPaymentsWrapperString = JSON.serialize(offerAndPaymentsWrap);
        // Call the saveOfferAndSettlements method
        Test.startTest();
        ApexActionResult result = SettlementPaymentsController.saveOfferAndSettlements(offerAndPaymentsWrapperString);
        Test.stopTest();

        // Verify the results
      //  System.assertNotEquals(null, result.data, 'Save operation should return data');
    }
    
       @isTest
    static void testSimulateSettlementsAccepted() {
        setupTestData(); // Setup test data
        
        Offer__c offer = [SELECT Id FROM Offer__c Where Offer_Status__c != 'Accepted'  LIMIT 1];
        offer.Offer_Status__c = 'In Review';
        update offer;
 

		// Query for the Opportunity
        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];


        // Query for the Account
        Account account = [SELECT Id FROM Account  LIMIT 1];
      

        // Query for the Debt Detail
        Debt_Details__c debtDetail = [SELECT Id FROM Debt_Details__c  LIMIT 1];
     
        
        // Creating a mock OfferWrapper object
        OfferWrapper offerWrap = new OfferWrapper();
        offerWrap.offerId = offer.Id;
        offerWrap.opportunityId = opp.Id;
        offerWrap.accountId = account.Id;
        offerWrap.debtDetailId = debtDetail.Id;
        offerWrap.paymentMethod = 'Wire';
        offerWrap.settlementFrequency = 'Monthly';
        offerWrap.settlementTerm = '8';
        offerWrap.totalSettlementAmount = 500;
        offerWrap.offerAmount = 500;
        offerWrap.recurringDay = '1';
        offerWrap.settlementStartDate = Date.today();
        offerWrap.diffInAmount = 10000;
        offerWrap.draftAmountPerPayment = 190;
        offerWrap.offerStatus = 'In Review';
        offerWrap.downPayment = 200;
        
        String offerDetailsJson = JSON.serialize(offerWrap);

        // Call the simulateSettlements method
        Test.startTest();
       // SettlementPaymentsController.getPayments(offerWrap);
        ApexActionResult result = SettlementPaymentsController.simulateSettlements(offerDetailsJson);
        Test.stopTest();

        // Verify the results
      //  System.assertNotEquals(null, result.data, 'Simulated settlements data should not be null');
    }
    
    @isTest
    static void testPutExistingSettlementsIntoPaymentWrapper(){
             Opportunity opp = new Opportunity(Name = 'Test Opportunity', CloseDate = Date.today(), StageName = 'Prospecting');
        insert opp;

                Offer__c offer = new Offer__c(Opportunity__c = opp.Id, Offer_Status__c = 'Accepted',Payment_Method__c = 'Wire',Payment_Method_Amount__c = 15,
                                     Total_Settlement_Amount__c = 500, Settlement_Frequency__c = 'Monthly' ,Settlement_Term__c = '6',offer_Amount__c = 400);
        insert offer;
        
        Id recId = SettlementUtil.getRecordTypeId(SettlementUtil.RT_SETTLEMENTS);
        
        Settlement__c settlement = new Settlement__c(Offer__c = offer.Id,RecordTypeId = recId,Opportunity__c = opp.Id);
        insert settlement; 
        
              List<SettlementPaymentsController.PaymentWrapper> paymentWrapper1 = new List<SettlementPaymentsController.PaymentWrapper>();

        SettlementPaymentsController.putExistingSettlementsIntoPaymentWrapper(New List<Settlement__c> {settlement},paymentWrapper1);
    }

    /*@isTest
    static void testGetPayments() {
        setupTestData(); // Setup test data

        // Create a mock OfferWrapper
        OfferWrapper offerWrap = new OfferWrapper();
     //   offerWrap.offerId = 'TestOfferId';
        offerWrap.opportunityId = 'TestOpportunityId';
        offerWrap.accountId = 'TestAccountId';
        offerWrap.debtDetailId = 'TestDebtDetailId';
        offerWrap.settlementStartDate = Date.today();

        // Call the getPayments method
        Test.startTest();
        List<object> paymentWrappers = SettlementPaymentsController.getPayments(offerWrap);
        Test.stopTest();

        // Verify that payments are returned
        System.assertNotEquals(0, paymentWrappers.size(), 'There should be payments returned');
    } */
}
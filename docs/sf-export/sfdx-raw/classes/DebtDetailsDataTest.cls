@isTest
private class DebtDetailsDataTest {
    /**
    * @Description: Test setup method to create the test records
    **/
    @testSetup
    static void makeData() {
        Payment_Processor__c procSas = DataFactoryTest.createPaymentProcessor();
        insert procSas;
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        Opportunity oppty = DataFactoryTest.createOpportunity();
        oppty.AccountId = acct.Id;
        insert oppty;
        Program_Plan__c pgmPlan = DataFactoryTest.createProgramplan(oppty.Id, acct.Id, procSas.id);
        insert pgmPlan;
        Debt_Details__c debtDetails = DataFactoryTest.createDebtDetails(pgmPlan.id);
        debtDetails.Account__c = oppty.AccountId;
        debtDetails.Opportunity__c = oppty.Id;
        insert debtDetails;
    }
    @isTest
    static void testAggregateDebtDetails() {
        // Create test data
        Opportunity testOpportunity = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Closed Won', CloseDate = Date.today()
        );
        insert testOpportunity;
        // Create test debt details related to the opportunity
        Debt_Details__c testDebt1 = new Debt_Details__c(
            Opportunity__c = testOpportunity.Id, Debt_Amount__c = 1000 
        );
        Debt_Details__c testDebt2 = new Debt_Details__c(
            Opportunity__c = testOpportunity.Id, Debt_Amount__c = 2000
        );
        insert new List<Debt_Details__c>{ testDebt1, testDebt2 };
        // Call the method under test
        Test.startTest();
        List<AggregateResult> results = DebtDetailsData.aggregateDebtDetails(testOpportunity.Id);
        Test.stopTest();
        // Verify the results
        System.assertEquals(1, results.size(), 'One aggregate result should be returned');
        System.assertEquals(2, results[0].get('noOfDebts'), 'The number of debts should be 2');
        System.assertEquals(3000, results[0].get('totalDebt'), 'The total debt amount should be 3000');
    }
    /**
	* Method to test the getDebtDetails method in the DebtDetailsData class.
	* This method verifies if the getDebtDetails method returns valid debt details for the given debt IDs.
	*/
     @isTest
    static void testGetDebtDetails() {
        Set<Id> debtIdSet = new Set<Id>();
        Debt_Details__c debt = [SELECT Id FROM Debt_Details__c LIMIT 1];
        debtIdSet.add(debt.Id);
        Map<Id, Debt_Details__c> debtDetailsMap = DebtDetailsData.getDebtDetails(debtIdSet);

        System.assertEquals(true, !debtDetailsMap.isEmpty(), 'Debt details map should not be empty');
    }
    /**
	 * Method to test the getDebtDetailByOppId method in the DebtDetailsData class.
	* This method verifies if the getDebtDetailByOppId method returns valid debt details for the given Opportunity ID.
	*/
    @isTest
    static void testGetDebtDetailByOppId() {
        Debt_Details__c debt = [SELECT Id,Opportunity__c,Account__c FROM Debt_Details__c LIMIT 1];
        List<Debt_Details__c> debtList = DebtDetailsData.getDebtDetailByOppId(debt.Opportunity__c);
        Test.Starttest();
        DebtDetailsData.aggregateDebtsIncludedInProgram(debt.Opportunity__c);
        DebtDetailsData.getDebtDetailByAcctId(debt.Account__c);
        DebtDetailsData.getDebtDetails(debt.Id);
        DebtDetailsData.getAllDebtDetailByOppId(debt.Opportunity__c);
        DebtDetailsData.getProgramPlanByDebtDetials(debt.Id);
        DebtDetailsData.getAllDebtDetailByAccId(debt.Account__c);
        System.assertEquals(true, !debtList.isEmpty(), 'Debt details List should not be empty');
        Test.StopTest();
    }
    @isTest
    static void testGetDebtDetailsByAccount(){
        Account acc = [select id from Account LIMIT 1];
        set<Id> accountIdSet = new set<Id>{acc.id};
        List<Debt_Details__c> debtList =   DebtDetailsData.getDebtDetailsByAccount(accountIdSet);
        assert.isNotNull(debtList, 'Debt Details should not be empty');
    }
    @isTest
    static void getDebtDetailsTest(){
         Debt_Details__c debt = [SELECT Id FROM Debt_Details__c LIMIT 1];
        List<Debt_Details__c> debtDetails = DebtDetailsData.getDebtDetails(debt.Id);

        System.assertEquals(true, !debtDetails.isEmpty(), 'Debt details should not be empty');
    }
    @isTest
    static void getAllDebtDetailByOppIdTest(){
        List<Opportunity> opp = [SELECT Id,Name FROM Opportunity lIMIT 1];
        List<Debt_Details__c> debtDetails = DebtDetailsData.getAllDebtDetailByOppId(opp[0].Id);

        System.assertEquals(true, !debtDetails.isEmpty(), 'Debt details should not be empty');
    }
    @isTest
    static void getProgramPlanByDebtDetialsTest(){
         Debt_Details__c debt = [SELECT Id FROM Debt_Details__c LIMIT 1];
        List<Debt_Details__c> debtDetails = DebtDetailsData.getProgramPlanByDebtDetials(debt.Id);

        System.assertEquals(true, !debtDetails.isEmpty(), 'Debt details should not be empty');
    }
    @isTest
    static void getAllDebtDetailByAccIdTest(){
         Account acc = [SELECT Id FROM Account LIMIT 1];
        List<Debt_Details__c> debtDetails = DebtDetailsData.getAllDebtDetailByAccId(acc.Id);

        System.assertEquals(true, !debtDetails.isEmpty(), 'Debt details should not be empty');
    }
     @isTest
    static void getDebtDetailWithOutCreditorByOppIdTest(){
        List<Opportunity> opp = [SELECT Id,Name FROM Opportunity lIMIT 1];
        List<Debt_Details__c> debtDetails = DebtDetailsData.getDebtDetailWithOutCreditorByOppId(opp[0].Id);

        System.assertEquals(true, !debtDetails.isEmpty(), 'Debt details should not be empty');
    }
}
@IsTest
private class CreditorInformationControllerTest {
    
    @IsTest
    static void debtDetailsControllerTest_Success(){
        
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        Opportunity oppty = DataFactoryTest.createOpportunity();
        insert oppty;
        Payment_Processor__c processor = DataFactoryTest.createPaymentProcessor();
        insert processor;
        Program_Plan__c programPlan = DataFactoryTest.createProgramPlan(oppty.Id, acct.Id, processor.Id);
        insert programPlan;
        Debt_Details__c debt1 = new Debt_Details__c(
            Opportunity__c = oppty.Id, Debt_Amount__c = 50000, Creditor_Name__c = 'Test Creditor 1', 
            Payment__c = 1000, Payment_Frequency__c = 'Daily', Program_Plan__c = programPlan.Id
        );
        Debt_Details__c debt2 = new Debt_Details__c(
            Opportunity__c = oppty.Id, Debt_Amount__c = 20000, Creditor_Name__c = 'Test Creditor 2', 
            Payment__c = 3000, Payment_Frequency__c = 'Weekly', Program_Plan__c = programPlan.Id
        );
        insert new List<Debt_Details__c>{ debt1, debt2 };
            
        List<Debt_Details__c> debtDetails = CreditorInformationController.getDebtDetails(oppty.Id);
        
        Test.startTest();
        String result = CreditorInformationController.saveDebtDetails(oppty.Id, JSON.serialize(debtDetails), 100.00);
        Test.stopTest();
        
        System.assertEquals('success', result);
        System.assertEquals(2, Database.countQuery('SELECT COUNT() FROM Debt_Details__c'));
    }
    
    @IsTest
    static void debtDetailsControllerTest_Failure(){
        
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        Opportunity oppty = DataFactoryTest.createOpportunity();
        insert oppty;
        Debt_Details__c debt1 = new Debt_Details__c(
            Opportunity__c = oppty.Id, Debt_Amount__c = 50000, Creditor_Name__c = 'Test Creditor 1', 
            Payment__c = 1000, Payment_Frequency__c = 'Daily'
        );
        insert debt1;
            
        List<Debt_Details__c> debtDetails = CreditorInformationController.getDebtDetails(oppty.Id);
        
        Test.startTest();
        String result = CreditorInformationController.saveDebtDetails(oppty.Id, JSON.serialize(debtDetails), 100.00);
        Test.stopTest();
        
        System.assertEquals('Insert failed. Please create a program plan to add debt details.', result);
    }
    
    @IsTest
    static void debtDetailsControllerTest_Delete(){
        
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        Opportunity oppty = DataFactoryTest.createOpportunity();
        insert oppty;
        Payment_Processor__c processor = DataFactoryTest.createPaymentProcessor();
        insert processor;
        Program_Plan__c programPlan = DataFactoryTest.createProgramPlan(oppty.Id, acct.Id, processor.Id);
        insert programPlan;
        Debt_Details__c debt1 = new Debt_Details__c(
            Opportunity__c = oppty.Id, Debt_Amount__c = 50000, Creditor_Name__c = 'Test Creditor 1', 
            Payment__c = 1000, Payment_Frequency__c = 'Daily', Program_Plan__c = programPlan.Id
        );
        Debt_Details__c debt2 = new Debt_Details__c(
            Opportunity__c = oppty.Id, Debt_Amount__c = 20000, Creditor_Name__c = 'Test Creditor 2', 
            Payment__c = 3000, Payment_Frequency__c = 'Weekly', Program_Plan__c = programPlan.Id
        );
        insert new List<Debt_Details__c>{ debt1, debt2 };
            
        String debtDetailsDelete = '[{"Id":"'+debt1.Id+'","Creditor_Name__c":"Test Creditor 1","Debt_Amount__c":50000,'
            +'"Payment__c":1000,"Payment_Frequency__c":"Daily", "Opportunity__c":"'+oppty.Id+'","Program_Plan__c":"+programPlan.Id+"}]';         
        
        Test.startTest();
        String result = CreditorInformationController.saveDebtDetails(oppty.Id, debtDetailsDelete, 100.00);
        Test.stopTest();
        
        System.assertEquals('success', result);
        System.assertEquals(1, Database.countQuery('SELECT COUNT() FROM Debt_Details__c'));
    }
}
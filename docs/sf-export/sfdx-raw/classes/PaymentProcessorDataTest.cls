@IsTest
private class PaymentProcessorDataTest {
    
    @testSetup
    static void testSetup(){
        Account account = new Account(Name = 'XYZ COMPANY');
        insert account;
        // Create a test Opportunity record
        Opportunity opportunity = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Prospect', 
            CloseDate = Date.today(), AccountId = account.Id
        );
        insert opportunity;
        
        Payment_Processor__c paymentprocessor = new Payment_Processor__c(
            Processor_Type__c='SAS', Name='SAS'
        );
        insert paymentprocessor; 
        
        Program_Plan__c programPlan = new Program_Plan__c(
            Opportunity__c = opportunity.Id, Client__c = account.Id, Last_Rescheduled_Date_Time__c = Date.today(),
            Payment_Processor__c = paymentprocessor.Id, Last_Rescheduled_By__c = UserInfo.getUserId()    
        );
        insert programPlan;
    }
    
    @IsTest
    static void testQueryPaymentProcessorRecord(){

        Payment_Processor__c processor = new Payment_Processor__c(Name = 'SAS', Processor_Type__c = 'SAS');
        insert processor;
        
        Test.startTest();
        List<Payment_Processor__c> processorList = PaymentProcessorData.queryPaymentProcessorRecord();
        Test.stopTest();
        
        System.assert(!processorList.IsEmpty());
        System.assertNotEquals(null, processorList[0]);
    }
    
    @IsTest
    static void testgetPaymentProcId(){

        Test.startTest();
        Id processorId = PaymentProcessorData.getPaymentProcId('SAS');
        Map<String, Id> processorMap = PaymentProcessorData.getPaymentProcId(New Set<String>{'SAS'});
        Test.stopTest();
        
        System.assertNotEquals(null, processorId);
         System.assertNotEquals(null, processorMap);
    }
    
     @IsTest
    static void testquerySASPaymentProceesor(){

        Test.startTest();
        Payment_Processor__c processor = PaymentProcessorData.querySASPaymentProceesor();
        List<Payment_Processor__c> processorList = PaymentProcessorData.getPaymentProcessors();
        Test.stopTest();
        
        System.assertNotEquals(null, processor);
        System.assertNotEquals(null, processorList);
    }
    
    @IsTest
    static void testqueryPaymentProcessor(){
        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];
        Test.startTest();
        Payment_Processor__c processor = PaymentProcessorData.queryPaymentProcessor(opp.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, processor);
    }
}
@isTest
private class DebtInformationControllerTest {
    
    @IsTest
    static void saveDebtDetailsTest_Success(){
        
        DebtInformationController.DebtWrapper debtWrap = new DebtInformationController.DebtWrapper();
        debtWrap.id='1';
        debtWrap.creditor='Bank of America';
        debtWrap.amount=10000;
        debtWrap.payment=100;
        debtWrap.frequency='Daily';
        
        DebtInformationController.DebtWrapper debtWrap1 = new DebtInformationController.DebtWrapper();
        debtWrap1.id='2';
        debtWrap1.creditor='Wells Fargo';
        debtWrap1.amount=20000;
        debtWrap1.payment=400;
        debtWrap1.frequency='Weekly';
        
        List<DebtInformationController.DebtWrapper> debtWrapList = new List<DebtInformationController.DebtWrapper>{debtWrap, debtWrap1};
            
        Lead leadInstance = new Lead(LastName = 'Test Lead', Phone = '9087654321', Company = 'Test Company');
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        insert leadInstance;
        
        Test.startTest();
        String result = DebtInformationController.saveDebtDetails(leadInstance.Id, JSON.serialize(debtWrapList));
        Test.stopTest();

        System.assertEquals('success', result);        
    }

    @IsTest
    static void saveDebtDetailsTest_Failure_Exception(){

        Lead leadInstance = new Lead(LastName = 'Test Lead', Company = 'Test Company', Phone = '9087654321');
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        insert leadInstance;
        String debtDetails = null;
        
        Test.startTest();
        String result = DebtInformationController.saveDebtDetails(leadInstance.Id, debtDetails);
        Test.stopTest();
		
        System.assertEquals('null input to JSON parser',result);        
    }

    @IsTest
    static void getDebtDetailsTest(){

        DebtInformationController.DebtWrapper debtWrap = new DebtInformationController.DebtWrapper();
        debtWrap.id='1';
        debtWrap.creditor='Bank of America';
        debtWrap.amount=10000.00;
        debtWrap.payment=100.00;
        debtWrap.frequency='Daily';
        
        DebtInformationController.DebtWrapper debtWrap1 = new DebtInformationController.DebtWrapper();
        debtWrap1.id='2';
        debtWrap1.creditor='Wells Fargo';
        debtWrap1.amount=20000.00;
        debtWrap1.payment=400.00;
        debtWrap1.frequency='Weekly';
        
        List<DebtInformationController.DebtWrapper> debtWrapList = new List<DebtInformationController.DebtWrapper>{debtWrap, debtWrap1};
            
        Lead leadInstance = new Lead(
            LastName = 'Test Lead', Company = 'Test Company', Phone = '9087654321', Creditor_1_Name__c = 'Bank of America',
            Creditor_2_Name__c = 'Wells Fargo', Creditor_1_Total_Debt__c = 10000, Creditor_2_Total_Debt__c = 20000, 
            Creditor_1_Payment__c = 100, Creditor_2_Payment__c = 400, Creditor_1_Payment_Frequency__c = 'Daily', 
            Creditor_2_Payment_Frequency__c = 'Weekly'
        );
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        insert leadInstance;
        
        Test.startTest();
        String result = DebtInformationController.getDebtDetails(leadInstance.Id);
        Test.stopTest();

        System.assertEquals(JSON.serialize(debtWrapList), result);        
    }
    
    public class MockHttpResponseGenerator implements HttpCalloutMock {

        public HttpResponse respond(HttpRequest request) {
            return new HttpResponse();
        }
    }
}
@isTest
public class FirstPaymentHandlerTest {

    @testSetup
    static void setup() {
        // 1. Create User
        Profile p = [SELECT Id FROM Profile WHERE Name='Closer' LIMIT 1]; 
        User u = new User(Alias = 'hndlr', Email='handler@test.com', 
            EmailEncodingKey='UTF-8', LastName='HandlerTest', LanguageLocaleKey='en_US', 
            LocaleSidKey='en_US', ProfileId = p.Id, 
            TimeZoneSidKey='America/Los_Angeles', UserName='handler_test_user@test.com');
        insert u;

        // 2. Create Tier & Payroll Buckets for a specific date (e.g., Today)
        Date d = Date.today();
        
        // For test stability, we manually construct what we expect
        String monthStr = String.valueOf(d.month());
        String mKey = u.Id + '-' + monthStr + '-' + d.year();
        
        Agent_Monthly_Tier__c amt = new Agent_Monthly_Tier__c(
            Closer__c = u.Id,
            Unique_Key__c = mKey,
            Month__c = monthStr,
            Active__c = true,
            Year__c = String.valueOf(d.year())
        );
        insert amt;

        // Construct Weekly Key Logic (Basic approximation for test setup)
        DateTime dt = DateTime.newInstance(d.year(), d.month(), d.day());
        Date dateToday = dt.date();
        Integer dayNum = Integer.valueOf(dt.format('u'));
        Date mondayDate = dateToday.addDays(-(dayNum - 1));
        Date sundayDate = mondayDate.addDays(6);
        String wKey = u.Id + '-' + mondayDate + '-' + sundayDate;
        Agent_Weekly_Payroll__c awp = new Agent_Weekly_Payroll__c(
            Closer__c = u.Id,
            Unique_Key__c = wKey,
            Start_Date__c = mondayDate,
            Active__c = true,
            End_Date__c = sundayDate
        );
        insert awp;
    }

    @isTest
    static void testInsertAndLink() {
        User u = [SELECT Id FROM User WHERE UserName='handler_test_user@test.com'];
        
        // Create Collection Record
        First_Payment_Collection__c fpc = new First_Payment_Collection__c(
            Closer__c = u.Id,
            First_Payment_Completed_Date__c = Date.today(),
            First_Payment_Amount__c = 1000
        );

        Test.startTest();
        insert fpc;
        Test.stopTest();

        // Assert Linkage
        First_Payment_Collection__c insertedFpc = [SELECT Agent_Monthly_Tier__c, Agent_Weekly_Payroll__c FROM First_Payment_Collection__c WHERE Id = :fpc.Id];
        
        System.assertNotEquals(null, insertedFpc.Agent_Monthly_Tier__c, 'Should be linked to Monthly Tier');
    }

    @isTest
    static void testRollups() {
        User u = [SELECT Id FROM User WHERE UserName='handler_test_user@test.com'];
        Agent_Monthly_Tier__c amt = [SELECT Id FROM Agent_Monthly_Tier__c LIMIT 1];
        Agent_Weekly_Payroll__c awp = [SELECT Id FROM Agent_Weekly_Payroll__c LIMIT 1];

        // Create a record that is ALREADY linked (simulating the After Insert / Rollup phase)
        First_Payment_Collection__c fpc = new First_Payment_Collection__c(
            Closer__c = u.Id,
            First_Payment_Completed_Date__c = Date.today(),
            Total_Debt_Amount__c = 100000,
            First_Payment_Amount__c = 500,
            Agent_Monthly_Tier__c = amt.Id,
            Agent_Weekly_Payroll__c = awp.Id
        );
        insert fpc;

        // Verify Totals Updated
        Agent_Monthly_Tier__c updatedAmt = [SELECT Total_First_Payment_Collected__c,Total_Debt_Amount__c FROM Agent_Monthly_Tier__c WHERE Id = :amt.Id];
        System.assertEquals(500, updatedAmt.Total_First_Payment_Collected__c);
        System.assertEquals(100000, updatedAmt.Total_Debt_Amount__c);
    }
}
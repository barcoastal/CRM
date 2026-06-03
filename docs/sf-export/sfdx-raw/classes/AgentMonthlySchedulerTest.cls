@isTest
public class AgentMonthlySchedulerTest {

    @testSetup
    static void setup() {
        Profile p = [SELECT Id FROM Profile WHERE Name='Closer' LIMIT 1]; 
        User u = new User(Alias = 'stndt', Email='standarduser@testorg.com', 
            EmailEncodingKey='UTF-8', LastName='Testing', LanguageLocaleKey='en_US', 
            LocaleSidKey='en_US', ProfileId = p.Id, 
            TimeZoneSidKey='America/Los_Angeles', UserName='unique_test_user_monthly@testorg.com');
        insert u;
    }

    @isTest
    static void testScheduledExecution() {
        Test.startTest();
        String cronExp = '0 0 0 15 * ?';
        String jobId = System.schedule('Test Monthly Job', cronExp, new AgentMonthlyScheduler());
        Test.stopTest();
        
        CronTrigger ct = [SELECT Id, CronExpression, TimesTriggered FROM CronTrigger WHERE Id = :jobId];
        System.assertEquals(cronExp, ct.CronExpression);
    }

    @isTest
    static void testManualExecution() {
        Integer targetMonth = 1;
        Integer targetYear = 2026;

        Test.startTest();
        AgentMonthlyScheduler manualJob = new AgentMonthlyScheduler(targetMonth, targetYear);
        manualJob.execute(null); 
        Test.stopTest();

        // Verify Records Created
        List<Agent_Monthly_Tier__c> records = [SELECT Id, Month__c, Year__c, Unique_Key__c FROM Agent_Monthly_Tier__c];
        System.assert(!records.isEmpty(), 'Should have created monthly records');
        
        Agent_Monthly_Tier__c amt = records[0];
        System.assertEquals('1', amt.Month__c);
        System.assertEquals('2026', amt.Year__c);
        System.assert(amt.Unique_Key__c.contains('1-2026'));
    }
}
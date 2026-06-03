@isTest
public class AgentWeeklySchedulerTest {

    @testSetup
    static void setup() {
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User' LIMIT 1]; 
        User u = new User(Alias = 'wtest', Email='weekly@testorg.com', 
            EmailEncodingKey='UTF-8', LastName='WeeklyTest', LanguageLocaleKey='en_US', 
            LocaleSidKey='en_US', ProfileId = p.Id, 
            TimeZoneSidKey='America/Los_Angeles', UserName='weekly_test_user@testorg.com');
        insert u;
    }

    @isTest
    static void testManualExecution() {
        // Define a specific week: Mon Jan 12, 2026 to Sun Jan 18, 2026
        Date startDt = Date.newInstance(2026, 1, 12);
        Date endDt = Date.newInstance(2026, 1, 18);
        Date targetDt = Date.newInstance(2026, 1, 19); // Day "job runs"

        Test.startTest();
        AgentWeeklyScheduler manualJob = new AgentWeeklyScheduler(targetDt, startDt, endDt);
        manualJob.execute(null);
        Test.stopTest();

        // Verify Records
        List<Agent_Weekly_Payroll__c> records = [SELECT Id, Start_Date__c, End_Date__c, Unique_Key__c FROM Agent_Weekly_Payroll__c];
        System.assert(!records.isEmpty(), 'Weekly records should be created');
        
        Agent_Weekly_Payroll__c awp = records[0];
        System.assertEquals(startDt, awp.Start_Date__c);
        System.assertEquals(endDt, awp.End_Date__c);
        // Ensure Key format
        System.assert(awp.Unique_Key__c.contains(String.valueOf(startDt)));
    }
    
    @isTest
    static void testFinalizePreviousWeek() {
        // Setup "Previous Week" Draft record
        User u = [SELECT Id FROM User LIMIT 1];
        Date prevStart = Date.today().addDays(-7);
        Date prevEnd = Date.today().addDays(-1);
        
        Agent_Weekly_Payroll__c prevRec = new Agent_Weekly_Payroll__c(
            Closer__c = u.Id,
            Start_Date__c = prevStart,
            End_Date__c = prevEnd,
            Calculation_Status__c = 'Draft',
            Unique_Key__c = u.Id + '-' + prevStart + '-' + prevEnd
        );
        insert prevRec;

        Test.startTest();
        // Run Default Scheduler (assumes "Today" is the target)
        AgentWeeklyScheduler job = new AgentWeeklyScheduler();
        job.execute(null);
        Test.stopTest();
        
        // Verify Status Change
        Agent_Weekly_Payroll__c updatedRec = [SELECT Calculation_Status__c FROM Agent_Weekly_Payroll__c WHERE Id = :prevRec.Id];
        System.assertEquals('Finalized', updatedRec.Calculation_Status__c);
    }
}
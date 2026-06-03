@isTest
public with sharing class Schedule_ArchDupeLeadsOfConvLeads_Test {
    @isTest
    static void testScheduler() {
        Test.startTest();
        System.schedule('Schedule Archive Dupe Leads', '0 0 2 * * ? *', new Schedule_ArchDupeLeadsOfConvertedLeads());
        Test.stopTest();
        List<AsyncApexJob> asyncJobs = [SELECT Id FROM AsyncApexJob WHERE ApexClass.Name = 'Schedule_ArchDupeLeadsOfConvertedLeads'];
        Assert.isTrue(asyncJobs.size() >=1 , 'Verifying the schedule job is created');
    }
}
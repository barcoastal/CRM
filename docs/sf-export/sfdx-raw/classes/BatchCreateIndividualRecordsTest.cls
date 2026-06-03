@IsTest
public class BatchCreateIndividualRecordsTest {
    
    @testSetup
    public static void testSetup(){
        
        // Create test data
    }
    
    @IsTest
    public static void testBatchCreateIndividualRecords(){
        
        // Run the batch job
        Test.startTest();
         
        // Create test data
        List<Lead> leads = new List<Lead>();
        for (Integer i = 100; i < 300; i++) {
            leads.add(new Lead(
                FirstName = 'Test',
                LastName = 'Lead' + i,
                Email = 'test' + i + '@example.com',
                Phone = '1234567'+i
            ));
        }
        LeadTriggerHandler.byPassLeadTrigger = true;
        insert leads;
        Batch_CreateIndividualsForExistRecords batchJob = new Batch_CreateIndividualsForExistRecords();
        Id batchId = Database.executeBatch(batchJob,200);
        Test.stopTest();
        
        // Verify the results
        List<Lead> leadsList = [SELECT Id, IndividualId FROM Lead WHERE IndividualId != Null];
        System.assertEquals(200, leadsList.size(), 'Expected 200 leads to be created');
        for (Lead lead : leadsList) {
            System.assertNotEquals(null, lead.IndividualId, 'Expected IndividualId to be populated for each lead');
        }
    }
}
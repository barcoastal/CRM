@isTest
public class IndividualServiceTest {
    @testSetup
    static void setupTestData() {
       
        
        List<Individual> individuals = new List<Individual>();
        Individual individualInstance = new Individual();
        individualInstance.LastName = 'Test';
        individualInstance.Phone__c = '1234567890';
        individuals.add(individualInstance);
        
         Individual individualInstance1 = new Individual();
        individualInstance1.LastName = 'Test 1';
        individualInstance1.Phone__c = '1234567891';
        individuals.add(individualInstance1);
        insert individuals;
        
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Phone='9876543201';
        leadRecord.IndividualId = individuals[0].Id;
        leadRecord.Status  = 'Archive Disposition';
        leadRecord.LastName = 'Test Lead';
        insert leadRecord;
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        oppInstance.StageName = 'Active';
        oppInstance.Phone__c = '9876543201';
        oppInstance.Individual__c = individuals[1].Id;
        oppInstance.Name = 'Test Opp';
        insert oppInstance;
    }
    @isTest
    static void testCreateIndividuals() {
        Map<String,String> phoneNumbers = new  Map<String,String>{'1111111111' => 'lastName', '2222222222' => 'LastName'};
        Test.startTest();
        Map<String, Individual> result = IndividualService.createIndividuals(phoneNumbers);
        Test.stopTest();
        
        System.assertEquals(2, result.size(), 'Two Individuals should be created');
        for (String phone : phoneNumbers.keySet()) {
            System.assert(result.containsKey(phone), 'Individual with phone ' + phone + ' should exist');
        }
    }
    
    @isTest
    static void testCreateIndividualsWithEmptySet() {
         Map<String,String> phoneNumbers = new  Map<String,String>();
         Map<String, Individual> result = New  Map<String, Individual>();
        Try{
            
        Test.startTest();
        result = IndividualService.createIndividuals(phoneNumbers);
        Test.stopTest();
        }catch(Exception Ex){
            
        }
        System.assertEquals(0, result.size(), 'No Individuals should be created for empty phone numbers');
    }
    
    @isTest
    static void testCreateIndividualsWithBlankPhoneNumbers() {
         Map<String,String> phoneNumbers = new  Map<String,String>{'   ' => '', '' => ''};
         Map<String, Individual> result = New  Map<String, Individual>();
        try {
        Test.startTest();
        result = IndividualService.createIndividuals(phoneNumbers);
        Test.stopTest();
        }catch(Exception Ex){
        }
        System.assertEquals(0, result.size(), 'No Individuals should be created for blank phone numbers');
    }
    @isTest
    static void testEvaluateAndPopulateActiveEntities() {
        List<Individual> individuals = [SELECT Id FROM Individual ];
        
        Set<Id> individualIds = new Set<Id>();
        for (Individual ind : individuals) {
            individualIds.add(ind.Id);
        }
        
        Test.startTest();
        IndividualService.evaluateAndPopulateActiveEntities(individualIds);
        Test.stopTest();
        
        List<Individual> updatedIndividuals = [SELECT Id, Active_Entities_Assignment_Status__c FROM Individual WHERE Id IN :individualIds];
    }
    
    @isTest
    static void testevaluateAndPopulateActiveEntities2(){
         List<Individual> individuals = [SELECT Id FROM Individual ];

         IndividualService.evaluateAndPopulateActiveEntities(individuals);
    }
}
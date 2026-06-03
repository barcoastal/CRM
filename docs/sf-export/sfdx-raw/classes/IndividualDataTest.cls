@isTest
public class IndividualDataTest {
   
    @isTest
    static void queryIndividualByPhoneTest(){
        Individual ind = New Individual();
        ind.LastName = 'Test';
        ind.Phone__c = '1234567890';
        insert ind;
        List<Individual> individualList = IndividualData.queryIndividualByPhone(New Set<String> {'1234567890'});
        System.AssertNotEquals(individualList,Null);
    }
    
    @isTest
    static void queryIndividaulsByActiveLeadTest(){
        Lead leadInst = New Lead();
        leadInst.LastName = 'Test';
        leadInst.Phone = '1234567890';
        insert leadInst;
        
        List<Individual> individualList = IndividualData.queryIndividaulsByActiveLead(New Set<Id> {leadInst.id});
         System.AssertNotEquals(individualList,Null);
    }
}
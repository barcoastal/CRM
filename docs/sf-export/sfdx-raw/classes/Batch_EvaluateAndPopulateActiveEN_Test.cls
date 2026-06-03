@isTest
public class Batch_EvaluateAndPopulateActiveEN_Test {
     
    @isTest
    static void TestBatch_EvaluateAndPopulateActiveEN(){
        Test.startTest();
        List<Lead> leadsToUpdate = New List<Lead>();
        for(integer i=1; i<5 ;i++){
            Lead leadInstance = new Lead();
            leadInstance.LastName = 'Test ' + i;
            leadInstance.phone = '1223344'+i;
            leadsToUpdate.add(leadInstance);
         }
        insert leadsToUpdate;
        
        List<Individual> individualsToUpdate = New List<Individual>();
        for(individual individuals : [Select Id,Name,Active_Lead__c,Active_Account__c,Active_Opportunity__c from Individual]){
            individuals.active_lead__c = null;
            individuals.Active_Account__c = null;
            individuals.Active_Opportunity__c = null;
            
            individualsToUpdate.add(individuals);
        }
        update individualsToUpdate;
        
        List<Lead> leadsToUpdate2 = New List<Lead>();
        for(Integer i = 1; i < 5 ; i++){
            Lead leadInstance = new Lead();
            leadInstance.LastName = 'Test ' + i;
            leadInstance.phone = '1223344'+i;
            leadInstance.LeadSource = 'Web';
            leadsToUpdate2.add(leadInstance);
        }
        insert leadsToUpdate2;
        
        Id recordTypeBussinessAccount = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
          .get('Business_Account')
          .getRecordTypeId();
    Account AccountInstance = new Account();
    AccountInstance.Name = 'BatchTestnew' ;
    AccountInstance.Phone = '1223344102';
    AccountInstance.RecordtypeId = recordTypeBussinessAccount;
     insert AccountInstance;   
        
    Opportunity OpportunityInstance = new Opportunity();
    OpportunityInstance.Name = 'BatchTestnew ' ;
    OpportunityInstance.Phone__c = '1223344101';
    OpportunityInstance.closeDate = Date.today();
    OpportunityInstance.StageName = 'Working Opportunity';
    OpportunityInstance.AccountId = AccountInstance.Id;
    insert  OpportunityInstance;
        
        
        List<Individual> individualsToUpdate2 = New List<Individual>();
        for(individual individuals : [Select Id,Name,Active_Lead__c,Active_Account__c,Active_Opportunity__c from Individual]){
            individuals.active_lead__c = null;
            individuals.Active_Account__c = null;
            individuals.Active_Opportunity__c = null;
            individualsToUpdate2.add(individuals);
        }
        update individualsToUpdate2;
        Test.StopTest();  
    }
    
    /*@isTest
    static void TestBatch_EvaluateAndPopulateActiveEN(){
      Test.startTest();
      database.executeBatch(New Batch_EvaluateAndPopulateActiveEntities(),200); 
      Test.StopTest();  
        
      List<individual> individualsList = [Select Id,Name, Active_Lead__c From Individual Where Active_Lead__c = Null];  
      assert.areEqual(individualsList.size(),1);  
    }*/
}
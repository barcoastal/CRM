@isTest
public class LeadLifeCycleHandlerTest {
    
    @TestSetup
    public static void testSetup(){
        List<Lead> leadList = new List<Lead>();
        
        for(Integer i=0; i<5 ; i++ ){
            Lead leadInstance = new Lead();
            leadInstance.LastName = 'Web lead';
            leadInstance.Phone = '666666666'+i;
            leadInstance.LeadSource = 'Web';
            leadInstance.Industry = 'Automotive';
            leadList.add(leadInstance);
        }
        
        for(Integer i=0; i<3 ; i++ ){
            Lead leadInstance = new Lead();
            leadInstance.LastName = 'Non Web lead';
            leadInstance.Phone = '777777777'+i;
            leadInstance.Industry = 'Automotive';
            leadList.add(leadInstance);
        }
        insert leadList;
    }
   
    @isTest
    public static void handleLeadLifeCycleTest(){
        List<Lead> leadList = new List<Lead>();
        
        for(Integer i=0; i<5 ; i++ ){
            Lead leadInstance = new Lead();
            leadInstance.LastName = 'Test Lead';
            leadInstance.Phone = '123455678'+i;
            leadInstance.Industry = 'Automotive';
            leadList.add(leadInstance);
        }
        
        Test.startTest();
        insert leadList;
        Test.stopTest();
        
        list<Lead> newLeadList = [Select Id, Name , Status From Lead Where phone = '1234556780'];
        List<Individual> individualList = [Select Id,Name From Individual Where Active_Lead__c =: newLeadList[0].Id];
        System.assertEquals('New', newLeadList[0].Status, 'The lead status should be "New".');
        //Assert.areNotEqual(0,individualList.Size());
    }
    
      @isTest
    public static void activeWebLeadExistsTest(){
        Test.startTest();
            Lead leadInstance = new Lead();
            leadInstance.LastName = 'Web lead New';
            leadInstance.Phone = '6666666661';
            leadInstance.LeadSource = 'Web';
            leadInstance.Industry = 'Automotive';
            insert leadInstance;
        
        Test.stopTest();
        
        list<Lead> newLeadList = [Select Id, Name , Status From Lead Where Phone = '6666666661' And LastName = 'Web lead New'];
        //assert.areEqual('Archive Disposition', newLeadList[0].Status, 'The lead status should be "Archive Disposition".');
    }
    
    @isTest
    public static void activeNonWebLeadExistsTest(){
        Test.startTest();
            Lead leadInstance = new Lead();
            leadInstance.LastName = 'Web lead New';
            leadInstance.Phone = '7777777770';
            leadInstance.LeadSource = 'Web';
            leadInstance.Industry = 'Automotive';
            insert leadInstance;
        
        Test.stopTest();
        
        list<Lead> newLeadList = [Select Id, Name , Status From Lead Where Phone = '7777777770' and LastName = 'Non Web lead'];
       // assert.areEqual('Archive Disposition', newLeadList[0].Status, 'The lead status should be "Archive Disposition".');
    }
}
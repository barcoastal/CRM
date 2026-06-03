@isTest
private class Five9ConnectorServiceTest {

    @TestSetup
    static void makeData(){
        Account acct = DataFactoryTest.createBusinessAccount();
        acct.Lead_Number__c = '12345';
        acct.Bank_Name__c = 'Wells Fargo';
        acct.Bank_Account_Number__c = '13719713158835300';
        acct.Bank_Routing_Number__c = '122105155';
        acct.Work_Phone__c='9987654321';
        insert acct;
        
        Contact con = DataFactoryTest.createContact(acct.Id);
        insert con;        
                
        Opportunity opp = new Opportunity(
            Name = 'Test Opportunity', StageName = 'Closed Won First Payment Pending',
            CloseDate = Date.today(), AccountId = acct.Id
        );
        insert opp;
        
        LeadTriggerHandler.preventRecursion = true;

        Lead lead = new Lead();
        lead.FirstName = 'John';
        lead.LastName = 'Doe';
        lead.Phone = '6678769876';
        lead.Work_Phone__c = '9876543221';
        lead.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Lead', 'List_Lead');
        insert lead;
        
    }
        
    @IsTest
    static void doPostTest_Success(){ 
    
        Opportunity opp = [SELECT Id, Name FROM Opportunity Limit 1];
        
        Lead leadRec = [SELECT Id, Name FROM Lead Limit 1];
    
        Test.startTest();
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/services/apexrest/v1/Five9ConnectorService';
        req.httpMethod = 'POST';
      
        req.addParameter('ANI', 'test');
        req.addParameter('attempt_count', 'test');
        req.addParameter('full_name', 'test');
        req.addParameter('call_id', '98894654');
        req.addParameter('campaign_name', 'test');
        req.addParameter('Dialer Group', 'test');
        req.addParameter('disposition_name', 'test');
        req.addParameter('end_timestamp', '01:00');
        req.addParameter('f9_last_disposition', 'test');
        req.addParameter('f9_last_disposition_date', '14/07/24');
        req.addParameter('handle_time', 'test');
        req.addParameter('opportunity_id', opp.Id);
        req.addParameter('leadId', leadRec.Id);
        req.addParameter('session_id', '544845');
        req.addParameter('skill_name', 'test');
        req.addParameter('start_timestamp', '12:00');
        req.addParameter('user_name', 'test');
        req.addParameter('agent_id', '5451212');
        req.addParameter('hold_time', 'test');
        req.addParameter('language', 'English');
        req.addParameter('lead_id', leadRec.Id);
        req.addParameter('length', 'test');
        req.addParameter('number', 'test');
        req.addParameter('DNIS', 'test');
        
        RestContext.request = req;
        RestContext.response = res;       
        Five9ConnectorService.doPost();  
        Test.stopTest();
        
        /*Application_Log__c log = [SELECT Id,Statement__c  FROM Application_Log__c Limit 1];
        system.debug(':::log::'+ log);*/
    }
    
}
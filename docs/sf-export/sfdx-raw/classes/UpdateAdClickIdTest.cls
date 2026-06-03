@isTest
private class UpdateAdClickIdTest {
    @TestSetup
    static void makeData(){
        
       Lead leadInstance = DataFactoryTest.createBusinessLead();
       leadInstance.phone = '1234567890';
       leadInstance.LeadSource = 'Test';
       insert leadInstance;
    }
        
    @IsTest
    static void doPostTest_Success(){ 
 
        Test.startTest();
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/services/apexrest/UpdateAdClickId/';
        req.httpMethod = 'GET';
      
        req.addParameter('toPhoneNumber', '9844534321');
        req.addParameter('fromPhoneNumber', '1234567890');
        req.addParameter('adClickId', '1234567890');
        
        RestContext.request = req;
        RestContext.response = res;       
        UpdateAdClickId.doGet();  
        Test.stopTest();
        
        Lead leadInst = [SELECT Id,Ad_Click_Id__c FROM Lead WHERE Ad_Click_Id__c = '1234567890' LIMIT 1];
        Assert.areNotEqual(leadInst,Null);
    }
    
    @IsTest
    static void doPostTest_Failure(){ 
    
        Test.startTest();
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/services/apexrest/UpdateAdClickId/';
        req.httpMethod = 'GET';
      
        req.addParameter('toPhoneNumber', '1234567891');
        req.addParameter('fromPhoneNumber', '1234567890');
        
        RestContext.request = req;
        RestContext.response = res;       
        UpdateAdClickId.doGet();  
        Test.stopTest();
        
        List<Lead> leadInst = [SELECT Id,Ad_Click_Id__c FROM Lead WHERE Ad_Click_Id__c = '1234567890' LIMIT 1];
        Assert.areEqual(leadInst.size(),0);
    }
    
    @IsTest
    static void doPostTestFailure2(){ 
    
        Test.startTest();
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/services/apexrest/UpdateAdClickId/';
        req.httpMethod = 'GET';
      
        req.addParameter('toPhoneNumber', '1234567891');
        req.addParameter('fromPhoneNumber', '1234567890');
        req.addParameter('adClickId', '1234567890');
        
        RestContext.request = req;
        RestContext.response = res;       
        UpdateAdClickId.doGet();  
        Test.stopTest();
        
        List<Lead> leadInst = [SELECT Id,Ad_Click_Id__c FROM Lead WHERE Ad_Click_Id__c = '1234567890' LIMIT 1];
        Assert.areEqual(leadInst.size(),0);
    }
    
    @IsTest
    static void doPostTestFailure3(){ 
    
        Test.startTest();
        RestRequest req = new RestRequest(); 
        RestResponse res = new RestResponse();
        req.requestURI = '/services/apexrest/UpdateAdClickId/';
        req.httpMethod = 'GET';
      
        req.addParameter('toPhoneNumber', '9844534321');
        req.addParameter('fromPhoneNumber', '1234567899');
        req.addParameter('adClickId', '1234567890');
        
        RestContext.request = req;
        RestContext.response = res;       
        UpdateAdClickId.doGet();  
        Test.stopTest();
        
        List<Lead> leadInst = [SELECT Id,Ad_Click_Id__c FROM Lead WHERE Ad_Click_Id__c = '1234567890' LIMIT 1];
        Assert.areEqual(leadInst.size(),0);
    }
}
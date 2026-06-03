@isTest class SandboxRefreshScriptTest {

    @testSetup
    static void makeData() {  
    
        insert DataFactoryTest.createCitadelSettings();
        
        insert DataFactoryTest.createSASSettings();
        
        insert DataFactoryTest.createRAMSettings(); 
        
        insert DataFactoryTest.createTwilioSettings();
        
        insert DataFactoryTest.createFive9List();
    }

    @isTest
    static void testMySandboxPrep() { 

        Test.startTest();
        Test.testSandboxPostCopyScript(
            new SandboxRefreshScript(), UserInfo.getOrganizationId(),
                UserInfo.getOrganizationId(), UserInfo.getOrganizationName(), true);

        Test.stopTest();
         List<SAS_Settings__c> sasSetting = [SELECT Endpoint__c FROM SAS_Settings__c];
         System.assertEquals('https://sasdashboard.com/modules/Pd4tnbgk/process.aspx?APIKey=12801d1f-9f8a-4827-88e3-1b08eec15edc&CompanyKey=8', sasSetting[0].Endpoint__c , 'Verify the SAS Endpoint');
         
         List<RAMS_Settings__c> ramSetting = [SELECT Affiliate_ID__c, APIKey__c, Endpoint__c,Fee_Split_Group_ID__c FROM RAMS_Settings__c];
         System.assertEquals('https://staging.reliantpayment.com/Services/RAMSGatewayver2.asmx', ramSetting[0].Endpoint__c , 'Verify the RAM Endpoint');
         
         List<Citadel_Callout_Settings__c> citadel = [SELECT Endpoint__c FROM Citadel_Callout_Settings__c];
         System.assertEquals(null, citadel[0].Endpoint__c , 'Verify the Citadel Endpoint');
         
        List<Payment_Processor__c> paymentProcessorRecords = [SELECT Id, Name, Processor_Type__c,Monthly_Bank_Fee__c,Bank_Setup_Fee__c FROM Payment_Processor__c];
        System.assertEquals(2, paymentProcessorRecords.size() , 'Verify the record count');
    }   
    
}
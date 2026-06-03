/*----------------------------------------------------------------
    Author: Vinitha 
    Description: Removed production endpoint and updated the sandbox endpoint in custom setting while refreshing the sandbox in production.
    Test Class: SandboxRefreshScriptTest

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Apr-26-2024      Vinitha                      Initial Development            100%   
--------------------------------------------------------------------*/
public without sharing class SandboxRefreshScript implements SandboxPostCopy {
    public void runApexClass(SandboxContext context) {
        updateCustomSettings(); 
        createPaymentProcessorRecords(); 
    }

    private static void updateCustomSettings() {
        
        List<Citadel_Callout_Settings__c> citadel = [SELECT Endpoint__c FROM Citadel_Callout_Settings__c];
        if(citadel.size() > 0) {        
            citadel[0].Endpoint__c = '';
            update citadel;
        }
                
        List<RAMS_Settings__c> ramSetting = [SELECT Affiliate_ID__c, APIKey__c, Endpoint__c,Fee_Split_Group_ID__c FROM RAMS_Settings__c];
        if(ramSetting.size() > 0){
            ramSetting[0].Affiliate_ID__c ='';
            ramSetting[0].APIKey__c = '';
            //Here updated the sandbox RAM endpoint
            ramSetting[0].Endpoint__c = 'https://staging.reliantpayment.com/Services/RAMSGatewayver2.asmx';
            ramSetting[0].Fee_Split_Group_ID__c = '';
            Update ramSetting;
        }
        
        List<SAS_Settings__c> sasSetting = [SELECT Endpoint__c FROM SAS_Settings__c];
        if(sasSetting.size() > 0){
            //Here updated the sandbox SAS endpoint
            sasSetting[0].Endpoint__c ='https://sasdashboard.com/modules/Pd4tnbgk/process.aspx?APIKey=12801d1f-9f8a-4827-88e3-1b08eec15edc&CompanyKey=8';
            Update sasSetting;
        }
        
        List<TwilioConfig__c> twilioConfig = [SELECT AccountSid__c, ApplicationSid__c, AuthToken__c, From_Phone__c FROM TwilioConfig__c];
        if(twilioConfig.size() > 0){
            twilioConfig[0].ApplicationSid__c = '';
            //twilioConfig.AuthToken__c = '';
            twilioConfig[0].From_Phone__c = '';
            Update twilioConfig;
        }
        
        List<Five9LSP__Five9_List__c> five9List = [SELECT Id, Name FROM Five9LSP__Five9_List__c WHERE Name Like '%Production%'];
        if(!five9List.isEmpty()){
            delete five9List;
        }  
        
        if(!Test.isRunningTest()) {
            List<OutboundAni_Settings__mdt> MetadataList1 = new List<OutboundAni_Settings__mdt>();
            for(OutboundAni_Settings__mdt rec: [SELECT Id, DeveloperName,MasterLabel,Value__c FROM OutboundAni_Settings__mdt]){ 
                rec.Value__c = '';
                MetadataList1.add(rec);
            }            
            String jobId2 = MetaDataUtility.upsertMetadata(MetadataList1);
        }
    }
    
    //This method create payment processor records for RAM and SAS.
    private static void createPaymentProcessorRecords() {
        List<Payment_Processor__c> processorList = new List<Payment_Processor__c>{
            new Payment_Processor__c(Name='RAM', Processor_Type__c = 'RAM',Monthly_Bank_Fee__c =10.95,Bank_Setup_Fee__c = 20),
            new Payment_Processor__c(Name='SAS', Processor_Type__c = 'SAS',Monthly_Bank_Fee__c =15,Bank_Setup_Fee__c =10,
             Citadel_Fee_Payee_Id__c= '15', Program_Fee_Payee_Id__c= '16', Retainer_Fee_Payee_Id__c= '16', Service_Fee_Payee_Id__c= '16',
             Setup_Fee_Payee_Id__c= '16'               
            ) 
        };
        insert processorList;
    }
}
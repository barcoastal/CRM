/*----------------------------------------------------------------
    Author: Vinitha 
    Description: Do API Callout When client synced with RAM or SAS
    Test Class: SyncToPaymentProcessorControllerTest

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Mar-20-2024      Vinitha                      Initial Development            91%   
--------------------------------------------------------------------*/
public inherited sharing class CitadelAPICallout{
    
    public static void makeCitadelCallout(Id accId) {
       Account acct = new Account();
       Contact cont = new Contact();
       
       try {
           ApexUtil.requireValue('Account Id', accId);
           acct = AccountData.queryAccount(accId)[0];
           ApexUtil.requireValue('Primary Contact', acct.Primary_Contact__c);
           cont = ContactData.getPrimaryContact(acct)[0];
           Opportunity oppRecord = OpportunityData.getActiveOpportunityId(accId);
           ContentVersion contVersion = FileData.getCitadelContractData(oppRecord);
           CitadelWrapper citadelWrap = new CitadelWrapper(acct, cont, contVersion);
           Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(citadelWrap));
           String requestBody = CitadelUtil.constructRequest(untypedMap, CitadelWrapper.createClientMap);
           doCallout(requestBody, accId);
       }catch(Exception exp) {
           ApplicationLogger.logException(exp, acct.Id);
       } 
    }
       
   private static void doCallout(String requestBody, String accId) {
       HttpClient httpClientInst = new HttpClient();
       HttpClient.HttpResponseWrapper responseWrapper;
       try {
           httpClientInst.method = HttpClient.Methods.POST;
           httpClientInst.endpoint = new CitadelSettings().endpoint;
           httpClientInst.requestBody = requestBody;
           httpClientInst.timeout = 120000;
           Map<String, String> headerMap = new Map<String, String> ();
           headerMap.put('Content-Type', 'application/x-www-form-urlencoded');
           httpClientInst.headerMap = headerMap;
           responseWrapper = httpClientInst.sendRequest();
           String calloutResponse = responseWrapper.baseResponse.getBody();
           if(responseWrapper.baseResponse.getStatusCode() == 200 && calloutResponse.contains('Success:')){
                Account acct = new Account();
                acct.Id = accId;
                acct.External_Citadel_Id__c = calloutResponse.split(':')[1];
                Update acct;
            }
           ApplicationLogger.logCalloutSuccess(httpClientInst.endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Callout request sent to Citadel', accId);
       } catch(System.Exception exp) { 
           ApplicationLogger.logCalloutException(httpClientInst.endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, exp, accId);
       }
   }
}
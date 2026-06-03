public with sharing class AsyncOpCitadelAPI {    
    
    public static void processOperations(List<Async_Operation__c> operations) {
        List<Async_Operation__c> asyncToUpdateList = new List<Async_Operation__c>();
        for (Async_Operation__c op : operations) {
             Async_Operation__c asyncOpToDML = new Async_Operation__c();
             try {
              makeCitadelCallout(op.Record_Id__c);
              asyncOpToDML = AsyncOperationUtil.createSuccessAsyncOperationDMLInstance(op.Id, null, null);
            } catch (Exception exp){
                asyncOpToDML = AsyncOperationUtil.createFailureAsyncOperationDMLInstance(op.Id, 'AsyncOpCitadelAPI Failed', null);
                ApplicationLogger.logException('Callout request sent to Citadel', op.Record_Id__c, exp.getMessage());
            } 
            asyncToUpdateList.add(asyncOpToDML);
        }
        
        if(!asyncToUpdateList.isEmpty()){        
            DMLService.performUpdateDML(asyncToUpdateList,'AsyncOpCitadelAPI');
        }
    }
    
    public static void makeCitadelCallout(Id accId) {
        Account acct = new Account();
        Contact cont = new Contact();
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
    }
       
   private static void doCallout(String requestBody, String accId) {
       HttpClient httpClientInst = new HttpClient();
       HttpClient.HttpResponseWrapper responseWrapper;
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
            ApplicationLogger.logCalloutSuccess(httpClientInst.endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Callout request sent to Citadel', accId);
        }
   }
}
public without sharing class  Batch_DeleteLeadsFromFive9List implements database.Batchable<SObject>, Database.AllowsCallouts {
    String five9ListName;
    public Batch_DeleteLeadsFromFive9List(String five9ListName){
      this.five9ListName = five9ListName;
    }
   
    public Database.queryLocator start(Database.batchableContext bc){
       return Database.getQueryLocator([select id,name,Status__c,Lead__c,Operation__c,Message__c from Async_Operation__c Where Operation__c =: 'Remove Lead From Five9 - API' AND Status__c IN ('pending','Failed') ]);
    }
    
    public void execute (Database.batchableContext bc,list<Async_Operation__c> scope){
     
        Set<Id> leadIds = New set<Id>();
        for(Async_Operation__c five9ListSync : (List<Async_Operation__c>)scope){
            leadIds.add(five9ListSync.lead__c);
        }

        if (String.isNotBlank(five9ListName)) {

            five9_lsp2__Five9_List_Config__c five9List = Five9ListData.getFive9Lsp2List(five9ListName,'Lead');
            Five9_API__c five9ApiSettings = Five9ListData.getFive9ApiSettings();
            if (Five9ListService.hasAuthorization(five9List)) {
                
                Map<String, Object> fieldMappingObject = New Map<String, Object>();
                //(Map<String, Object>)JSON.deserializeUntyped(five9List.Five9LSP__Field_Mapping__c);
               fieldMappingObject.put('lead_id', 'Id');
                
                if (fieldMappingObject != null && !fieldMappingObject.values().isEmpty()) {

                    DOM.Document document = Five9ListService.deleteFromFive9List(five9ListName, leadIds, fieldMappingObject);
                    
                    HttpClient httpInstance;
                    HttpClient.HttpResponseWrapper responseWrapper;
                    String endpoint = Five9ListService.getEndpoint(five9ApiSettings.API_URL__c);
                    try {
                        //Construct HTTP request
                        httpInstance = Five9ListService.constructRequestWrapper(endpoint, document, five9ApiSettings);
                        responseWrapper = httpInstance.sendRequest();
                        Boolean isSuccess;
                        Integer statusCode = responseWrapper.baseResponse.getStatusCode();
                        String responseMessage;
                        Dom.XMLNode bodyResult = Five9ListService.getBodyResult(responseWrapper.baseResponse.getbody());

                        if (statusCode == 200) {
                            isSuccess = true;
                            responseMessage = Five9ListService.parseSuccessResponse('deleteFromListResponse', bodyResult);
                            ApplicationLogger.logCalloutSuccess(
                                endpoint, httpInstance.constructedRequest, responseWrapper.baseResponse, 
                                'Batch_DeleteLeadsFromFive9List - '+responseMessage, five9List.Id
                            );
                        } else {
                            isSuccess = false;
                            responseMessage = Five9ListService.parseFaultResponse(bodyResult);
                            ApplicationLogger.logCalloutFailure(
                                endpoint, httpInstance.constructedRequest, responseWrapper.baseResponse, 
                                'Batch_DeleteLeadsFromFive9List - '+responseMessage, five9List.Id
                            );
                        }
                        
                        List<Async_Operation__c> asyncOperationToUpdate = new List<Async_Operation__c>();
                        List<Lead> leadList = new List<Lead>();
                        for (Async_Operation__c asyncOperation : scope) {
                            Async_Operation__c asycnOperationInstance = new Async_Operation__c();
                            asycnOperationInstance.Id = asyncOperation.Id;
                            if (isSuccess) {
                                asycnOperationInstance.Status__c = 'Completed';
                                 leadList.add(
                                    new Lead(Id = asyncOperation.Lead__c,Removed_From_Five9__c = true)
                                 );
                            } else {
                                asycnOperationInstance.Status__c = 'Failed';
                                asycnOperationInstance.Message__c = responseMessage;
                            }
                            asycnOperationInstance.Additional_Details__c = 'Synced Time : ' +  System.now() + ' , Five9ListName : ' +  five9List.five9_lsp2__Five9_List_Name__c;
                            asyncOperationToUpdate.add(asycnOperationInstance);
                        }
                        update asyncOperationToUpdate;
                        update leadList;
                    } catch(Exception exp) { 
                        System.debug('ex ' + exp);
                        //Create a log for exception
                       ApplicationLogger.logException(exp, null,'Batch_DeleteLeadsFromFive9List', 'High');
                    }
                }
            }
        }
        
    }
    
    public void finish(Database.batchableContext bc){
        
    }
}
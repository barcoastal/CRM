/*----------------------------------------------------------------
    Author: Dharanya Sekar
    Description: A batch class to add the leads to five9 list on bulk.
    Test Class: Batch_AddToFive9List_Test

    History
    <Date>           <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Apr-12-2024       Dharanya Sekar           Initial Development                 93%
--------------------------------------------------------------------*/
public without sharing class Batch_AddToFive9List implements Database.Batchable<SObject>, Database.AllowsCallouts{

    private String five9ListName;

    public Batch_AddToFive9List(String listName) {
        this.five9ListName = listName;
    }
    
    // Start method to query the five9 list item records which are in pending status.
    public Database.QueryLocator start(Database.BatchableContext bc){

        List<String> statusesToRetry = Five9ListService.getFive9StatusesToRetry();

        String query = 'SELECT Id, Name,five9_lsp2__Five9_List_Config__c, five9_lsp2__Five9_List_Config__r.five9_lsp2__Five9_List_Name__c, five9_lsp2__Lead__c, five9_lsp2__Last_Sync_Time__c,'
        +' five9_lsp2__Previous_Update_Time__c, five9_lsp2__Sync_Message__c, five9_lsp2__Sync_Status__c, five9_lsp2__last_allow_sync__c'
        +' FROM five9_lsp2__Five9_List_Item__c WHERE five9_lsp2__Sync_Status__c IN :statuses'
        +' AND five9_lsp2__Lead__c != null AND five9_lsp2__Five9_List_Config__r.five9_lsp2__Five9_List_Name__c = :listName';

        Map<String, Object> queryBinds = new Map<String, Object>{'statuses' => statusesToRetry, 'object' => 'lead', 'listName' => this.five9ListName};

        return Database.getQueryLocatorWithBinds(query, queryBinds, AccessLevel.SYSTEM_MODE);
    }

    // Execute method to do callout to sync the lead to five9 list
    public void execute(Database.BatchableContext bc, List<five9_lsp2__Five9_List_Item__c> scope) {
        Set<Id> leadIds = New Set<Id>();
        for(five9_lsp2__Five9_List_Item__c lsp2ListItem : scope){
            leadIds.add(lsp2ListItem.five9_lsp2__Lead__c);
        }

        if (String.isNotBlank(five9ListName)) {

            //Get the parent five9 list data which contains the five9 list configurations
            // Five9LSP__Five9_List__c five9List = Five9ListData.getFive9List(five9ListName,'Lead');
            five9_lsp2__Five9_List_Config__c five9List = Five9ListData.getFive9Lsp2List(five9ListName,'Lead');
            Five9_API__c five9ApiSettings = Five9ListData.getFive9ApiSettings();

            //Check if the parent five9 list record has all the configurations required for authorization and callout
            if (Five9ListService.hasAuthorization(five9List)) {
                Map<String, Object> fieldMappingObject = Five9ListData.getFive9Lsp2FieldMappings(five9List.five9_lsp2__Object_Fields_Mapping__c);
               // Map<String, Object> fieldMappingObject = (Map<String, Object>)JSON.deserializeUntyped(five9List.Five9LSP__Field_Mapping__c);
                fieldMappingObject.put('salesforce_id', 'Id');
                fieldMappingObject.remove('F9CallASAP');
                
                if (fieldMappingObject != null && !fieldMappingObject.values().isEmpty()) {

                    //Construct the body document for addToFive9List callout with nested xml nodes having five9 config and sf data
                    DOM.Document document = Five9ListService.addtoFive9List(five9ListName, leadIds, fieldMappingObject);
                    
                    HttpClient httpInstance;
                    HttpClient.HttpResponseWrapper responseWrapper;
                    String endpoint = Five9ListService.getEndpoint(five9ApiSettings.API_URL__c);
                    try {
                        //Construct HTTP request
                        httpInstance = Five9ListService.constructRequestWrapper(endpoint, document, five9ApiSettings);
                        //Send the HTTP request and return the HTTP response wrapper
                        responseWrapper = httpInstance.sendRequest();
                        Boolean isSuccess;
                        Integer statusCode = responseWrapper.baseResponse.getStatusCode();
                        String responseMessage;
                        //Get the response body xml node
                        Dom.XMLNode bodyResult = Five9ListService.getBodyResult(responseWrapper.baseResponse.getbody());

                        if (statusCode == 200) {
                            isSuccess = true;
                            //Parse and return the success response by traversing the child nodes
                            responseMessage = Five9ListService.parseSuccessResponse('addToListResponse', bodyResult);
                            //Create a log of the callout success
                            ApplicationLogger.logCalloutSuccess(
                                endpoint, httpInstance.constructedRequest, responseWrapper.baseResponse, 
                                'AddToFive9List - '+responseMessage, five9List.Id
                            );
                        } else {
                            isSuccess = false;
                            //Parese and return the fault response by traversing the child nodes.
                            responseMessage = Five9ListService.parseFaultResponse(bodyResult);
                            //Create a log for the callout failure
                            ApplicationLogger.logCalloutFailure(
                                endpoint, httpInstance.constructedRequest, responseWrapper.baseResponse, 
                                'AddToFive9List - '+responseMessage, five9List.Id
                            );
                        }
                        
                        List<five9_lsp2__Five9_List_Item__c> five9ListItemToUpdate = new List<five9_lsp2__Five9_List_Item__c>();
                        List<Lead> leadList = new List<Lead>();
                        //Loop through the data from start query and assign the sync message and status based on the callout response
                        for (five9_lsp2__Five9_List_Item__c listItem : scope) {
                            five9_lsp2__Five9_List_Item__c five9ListItem = new five9_lsp2__Five9_List_Item__c();
                            five9ListItem.Id = listItem.Id;
                            if (isSuccess) {
                                five9ListItem.five9_lsp2__Sync_Status__c = 'Verified';
                               // five9ListItem.five9_lsp2__Sync_Message__c = 'The request was successfully processed';
                                //Updating the Five9 List Id in the Lead if the sync is successful.
                                leadList.add(
                                    new Lead(Id = listItem.five9_lsp2__Lead__c, Five9_List_Id__c = listItem.five9_lsp2__Five9_List_Config__c)
                                );
                            } else {
                                five9ListItem.five9_lsp2__Sync_Status__c = 'Pending';
                                five9ListItem.five9_lsp2__Sync_Message__c = responseMessage;
                            }
                            //Assing the current value of the Last Sync Time to the new value of Previous Update Time
                            five9ListItem.five9_lsp2__Previous_Update_Time__c = listItem.five9_lsp2__Last_Sync_Time__c;
                            five9ListItem.five9_lsp2__Last_Sync_Time__c = System.now();
                            five9ListItemToUpdate.add(five9ListItem);
                        }
                        //update the sync status and message in all the five9 list items
                        update five9ListItemToUpdate;
                        //update the leads with five9 list Id
                        update leadList;
                    } catch(Exception exp) { 
                        //Create a log for exception
                        ApplicationLogger.logCalloutException(
                            endpoint, httpInstance.constructedRequest, 
                            responseWrapper.baseResponse, exp, null
                        );
                    }
                }
            }
        }
    }

    public void finish(Database.BatchableContext bc) {

    }
}